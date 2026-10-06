import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BookingError, reserveCustomerAppointment } from '@/lib/appointments';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAvailableAppointments, isDateOnly } from '@/lib/scheduling';

const requestSchema = z.object({ message: z.string().trim().min(1).max(500), conversationId: z.string().optional() });
const dayWords = { domingo: 0, segunda: 1, 'segunda-feira': 1, terça: 2, 'terça-feira': 2, terca: 2, quarta: 3, 'quarta-feira': 3, quinta: 4, 'quinta-feira': 4, sexta: 5, 'sexta-feira': 5, sábado: 6, 'sábado': 6, sabado: 6 };

function localDate(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function nextWeekday(baseDate, targetDay) {
  const date = new Date(`${baseDate}T12:00:00Z`);
  const difference = (targetDay - date.getUTCDay() + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + difference);
  return date.toISOString().slice(0, 10);
}

function parseDate(message, timeZone) {
  const text = message.toLowerCase();
  const base = localDate(timeZone);
  if (/\bhoje\b/.test(text)) return base;
  if (/\bamanh[ãa]\b/.test(text)) {
    const date = new Date(`${base}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }
  const numeric = text.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?\b/);
  if (numeric) {
    const [, day, month, year = String(new Date().getFullYear())] = numeric;
    const parsed = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return isDateOnly(parsed) ? parsed : '';
  }
  const weekdays = Object.entries(dayWords).sort((a, b) => b[0].length - a[0].length);
  const match = weekdays.find(([word]) => new RegExp(`\\b${word}\\b`, 'i').test(text));
  return match ? nextWeekday(base, match[1]) : '';
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function localIntent(message, services, styles, barbers, timeZone) {
  const text = normalize(message);
  const genericWords = ['corte', 'barba', 'servico', 'servicos'];
  const serviceMatches = services.filter((item) => normalize(item.name).split(/\s+/).some((word) => word.length > 3 && !genericWords.includes(word) && text.includes(word)));
  const exactService = services.find((item) => text.includes(normalize(item.name)));
  const service = exactService || (serviceMatches.length === 1 ? serviceMatches[0] : null);
  const styleMatches = styles.filter((item) => normalize(item.name).split(/\s+/).some((word) => word.length > 3 && !['corte', 'barba'].includes(word) && text.includes(word)));
  const styleAliases = { 'fade baixo': 'low fade', 'degrade baixo': 'low fade', 'fade medio': 'mid fade', 'degrade medio': 'mid fade', 'fade alto': 'high fade', 'degrade alto': 'high fade', 'taper': 'taper fade', 'social': 'corte social' };
  const styleName = Object.entries(styleAliases).find(([alias]) => text.includes(alias))?.[1];
  const style = styles.find((item) => text.includes(normalize(item.name))) || styles.find((item) => styleName && normalize(item.name) === styleName) || (styleMatches.length === 1 ? styleMatches[0] : null);
  const barber = barbers.find((item) => normalize(item.name).split(/\s+/).some((word) => word.length > 2 && text.includes(word)));
  const time = text.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s*(?:h|horas?)?\b/);
  const parsedTime = time ? `${String(time[1]).padStart(2, '0')}:${time[2] || '00'}` : '';
  const partOfDay = /\b(manhã|manha|cedo)\b/.test(text) ? 'morning' : /\b(tarde|depois do almoço)\b/.test(text) ? 'afternoon' : /\b(noite|noturno)\b/.test(text) ? 'evening' : '';
  return {
    serviceId: service?.id || '',
    styleId: style?.id || '',
    barberId: /sem preferência|tanto faz|qualquer barbeiro/.test(text) ? '' : barber?.id || '',
    date: parseDate(message, timeZone),
    time: parsedTime,
    partOfDay,
  };
}

async function extractIntent(message, services, styles, barbers, timeZone, adminGuidance) {
  const fallback = localIntent(message, services, styles, barbers, timeZone);
  if (!process.env.OPENAI_API_KEY) return fallback;
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      instructions: `Extraia somente a intenção de agendamento do texto. Retorne um objeto JSON com serviceId, styleId, barberId, date, time e partOfDay. Escolha IDs exclusivamente da lista fornecida; se o cliente não escolher, use string vazia. Nunca invente ID, preço, profissional ou horário. Datas devem ser YYYY-MM-DD. partOfDay é morning, afternoon, evening ou string vazia. Isto não executa agendamentos. Preferências da barbearia, subordinadas às regras anteriores: ${adminGuidance || 'Seja cordial e breve.'}`,
      input: JSON.stringify({ mensagem: message, hoje: localDate(timeZone), timezone: timeZone, servicos: services.map(({ id, name }) => ({ id, name })), estilos: styles.map(({ id, name }) => ({ id, name })), barbeiros: barbers.map(({ id, name }) => ({ id, name })) }),
      text: { format: { type: 'json_object' } },
      max_output_tokens: 160,
    });
    const parsed = JSON.parse(response.output_text || '{}');
    return {
      serviceId: fallback.serviceId,
      styleId: fallback.styleId,
      barberId: fallback.barberId,
      date: isDateOnly(parsed.date) ? parsed.date : fallback.date,
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.time || '') ? parsed.time : fallback.time,
      partOfDay: ['morning', 'afternoon', 'evening'].includes(parsed.partOfDay) ? parsed.partOfDay : fallback.partOfDay,
    };
  } catch (error) {
    console.error('AI intent extraction failed:', error.message);
    return fallback;
  }
}

function filterPartOfDay(options, partOfDay) {
  if (!partOfDay) return options;
  return options.filter(({ time }) => {
    const hour = Number(time.slice(0, 2));
    if (partOfDay === 'morning') return hour < 12;
    if (partOfDay === 'afternoon') return hour >= 12 && hour < 18;
    return hour >= 18;
  });
}

function formatDate(date, timeZone) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

async function saveConversation(session, conversation, messages) {
  const serialized = JSON.stringify(messages.slice(-30));
  if (conversation) return prisma.aIConversation.update({ where: { id: conversation.id }, data: { messages: serialized } });
  return prisma.aIConversation.create({ data: { tenantId: session.tenantId, userId: session.userId, messages: serialized } });
}

export async function POST(request) {
  const session = await requireSession(['CUSTOMER']);
  if (!session) return NextResponse.json({ error: 'Acesse sua conta para conversar com a assistente.' }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Escreva uma pergunta curta para continuar.' }, { status: 400 });

  const conversation = parsed.data.conversationId
    ? await prisma.aIConversation.findFirst({ where: { id: parsed.data.conversationId, tenantId: session.tenantId, userId: session.userId } })
    : null;
  const history = conversation ? JSON.parse(conversation.messages || '[]') : [];
  const previousAssistant = [...history].reverse().find((item) => item.role === 'assistant');
  const previousPending = previousAssistant?.pending || null;
  const message = parsed.data.message;
  const normalizedMessage = normalize(message);

  const catalog = await Promise.all([
    prisma.service.findMany({ where: { tenantId: session.tenantId, active: true }, select: { id: true, name: true, priceCents: true, durationMinutes: true }, orderBy: { name: 'asc' } }),
    prisma.hairStyle.findMany({ where: { tenantId: session.tenantId, active: true }, select: { id: true, name: true, description: true }, orderBy: { name: 'asc' } }),
    prisma.barber.findMany({ where: { tenantId: session.tenantId, active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { timezone: true, cancelNoticeHours: true, aiEnabled: true, aiInstructions: true } }),
  ]);
  const [services, styles, barbers, tenant] = catalog;
  if (!tenant) return NextResponse.json({ error: 'Barbearia não encontrada.' }, { status: 404 });
  if (!tenant.aiEnabled) return NextResponse.json({ error: 'O assistente está temporariamente desativado pela barbearia.' }, { status: 403 });
  let reply;
  let pending;

  const affirmative = /^(sim|confirmo|confirmar|pode confirmar|pode marcar|isso|perfeito|pode agendar|quero)(?:[,.!?].*|\s.*)?$/i.test(message.trim());
  if (previousPending?.kind === 'book' && affirmative) {
    try {
      const result = await reserveCustomerAppointment({ session, ...previousPending.booking, status: 'CONFIRMADO' });
      const appointment = result.appointment;
      reply = `Pronto! Agendamento confirmado. ${appointment.service.name} com ${appointment.barber.name}, ${formatDate(appointment.startsAt, tenant.timezone)} às ${new Intl.DateTimeFormat('pt-BR', { timeZone: tenant.timezone, hour: '2-digit', minute: '2-digit' }).format(appointment.startsAt)}. Código ${appointment.code}.`;
    } catch (error) {
      reply = error instanceof BookingError ? error.message : 'Não consegui confirmar o horário. Vamos consultar a disponibilidade novamente.';
    }
  } else if (previousPending?.kind === 'book' && /^(não|nao|deixa|cancelar|mudar)$/i.test(message.trim())) {
    reply = 'Tudo bem, não fiz nenhum agendamento. Diga outro serviço ou horário quando quiser.';
  } else if (previousPending?.kind === 'cancel' && affirmative) {
    const appointment = await prisma.appointment.findFirst({ where: { id: previousPending.appointmentId, tenantId: session.tenantId, customer: { userId: session.userId }, status: { in: ['PENDENTE', 'CONFIRMADO'] } }, include: { tenant: { select: { cancelNoticeHours: true } }, service: { select: { name: true } } } });
    if (!appointment) reply = 'Esse agendamento não está mais disponível para cancelamento.';
    else if (Date.now() > appointment.startsAt.getTime() - appointment.tenant.cancelNoticeHours * 3600000) reply = `A política da barbearia exige ${appointment.tenant.cancelNoticeHours} horas de antecedência, então não consigo cancelar este horário por aqui.`;
    else {
      await prisma.$transaction([
        prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELADO' } }),
        prisma.appointmentSlot.deleteMany({ where: { appointmentId: appointment.id } }),
      ]);
      reply = `Agendamento ${appointment.service.name} cancelado. A vaga foi liberada.`;
    }
  } else if (/\b(reagendar|reagende|mudar meu horário|trocar meu horário)\b/.test(normalizedMessage)) {
    const appointment = await prisma.appointment.findFirst({
      where: { tenantId: session.tenantId, customer: { userId: session.userId }, status: { in: ['PENDENTE', 'CONFIRMADO'] }, startsAt: { gte: new Date() } },
      include: { service: true, barber: { select: { name: true } }, hairStyle: { select: { name: true } } },
      orderBy: { startsAt: 'asc' },
    });
    if (!appointment) reply = 'Não encontrei um próximo horário para reagendar. Posso ajudar a criar um novo agendamento.';
    else {
      pending = { kind: 'select', booking: { rescheduleId: appointment.id, serviceId: appointment.serviceId, styleId: appointment.hairStyleId, barberId: appointment.barberId } };
      reply = `Vamos reagendar ${appointment.service.name}${appointment.hairStyle ? ` · ${appointment.hairStyle.name}` : ''}, atualmente com ${appointment.barber.name}. Para qual nova data e horário?`;
    }
  } else if (/\b(cancelar|cancela|cancele|desmarcar)\b/.test(normalizedMessage)) {
    const appointment = await prisma.appointment.findFirst({
      where: { tenantId: session.tenantId, customer: { userId: session.userId }, status: { in: ['PENDENTE', 'CONFIRMADO'] }, startsAt: { gte: new Date() } },
      include: { service: { select: { name: true } }, barber: { select: { name: true } }, tenant: { select: { timezone: true, cancelNoticeHours: true } } },
      orderBy: { startsAt: 'asc' },
    });
    if (!appointment) reply = 'Não encontrei próximos agendamentos para cancelar.';
    else {
      pending = { kind: 'cancel', appointmentId: appointment.id };
      reply = `Encontrei ${appointment.service.name} com ${appointment.barber.name}, ${formatDate(appointment.startsAt, tenant.timezone)} às ${new Intl.DateTimeFormat('pt-BR', { timeZone: tenant.timezone, hour: '2-digit', minute: '2-digit' }).format(appointment.startsAt)}. Quer confirmar o cancelamento?`;
    }
  } else if (/\b(meus agendamentos|minha agenda|meus horários|proximo corte|próximo corte)\b/.test(normalizedMessage)) {
    const appointments = await prisma.appointment.findMany({
      where: { tenantId: session.tenantId, customer: { userId: session.userId }, status: { in: ['PENDENTE', 'CONFIRMADO'] }, startsAt: { gte: new Date() } },
      include: { service: { select: { name: true } }, barber: { select: { name: true } } },
      orderBy: { startsAt: 'asc' },
      take: 5,
    });
    reply = appointments.length ? `Seus próximos horários: ${appointments.map((item) => `${item.service.name} com ${item.barber.name}, ${formatDate(item.startsAt, tenant.timezone)} às ${new Intl.DateTimeFormat('pt-BR', { timeZone: tenant.timezone, hour: '2-digit', minute: '2-digit' }).format(item.startsAt)}`).join('; ')}.` : 'Você ainda não tem horários futuros. Posso ajudar a encontrar um.';
  } else {
    const intent = await extractIntent(message, services, styles, barbers, tenant.timezone, tenant.aiInstructions);
    const text = normalizedMessage;
    const service = services.find((item) => item.id === intent.serviceId);
    const style = styles.find((item) => item.id === intent.styleId);
    const barber = barbers.find((item) => item.id === intent.barberId);
    const serviceMentioned = services.some((item) => normalize(item.name).split(/\s+/).some((word) => word.length > 3 && text.includes(word)));

    if (!service && !previousPending?.booking?.serviceId) {
      pending = { kind: 'select', booking: {} };
      reply = serviceMentioned ? 'Não identifiquei com segurança o serviço desejado. Escolha uma destas opções: ' : 'Qual serviço você gostaria de marcar? Tenho: ';
      reply += services.map((item) => `${item.name} (${money(item.priceCents)}, ${item.durationMinutes} min)`).join('; ') + '.';
    } else {
      const serviceId = service?.id || previousPending?.booking?.serviceId;
      const styleId = style?.id || previousPending?.booking?.styleId || null;
      const barberId = intent.barberId || previousPending?.booking?.barberId || null;
      const date = intent.date || previousPending?.booking?.date;
      const time = intent.time || '';
      if (!date) {
        pending = { kind: 'select', booking: { serviceId, styleId, barberId, rescheduleId: previousPending?.booking?.rescheduleId }, partOfDay: intent.partOfDay || previousPending?.partOfDay };
        reply = `Perfeito, ${services.find((item) => item.id === serviceId)?.name}. Para qual dia você gostaria? Posso consultar os próximos 90 dias.`;
      } else {
        const availability = await getAvailableAppointments({ tenantId: session.tenantId, date, serviceId, barberId });
        if (availability.error) reply = availability.error;
        else {
          const dayOptions = filterPartOfDay(availability.options, intent.partOfDay || previousPending?.partOfDay);
          const matchingTime = time ? dayOptions.filter((option) => option.time === time) : dayOptions;
          if (!dayOptions.length) reply = `Não há horários livres${intent.partOfDay ? ' nesse período' : ''} para ${formatDate(new Date(`${date}T12:00:00`), tenant.timezone)}. Quer consultar outra data?`;
          else if (time && matchingTime.length === 0) {
            pending = { kind: 'select', booking: { serviceId, styleId, barberId, date, rescheduleId: previousPending?.booking?.rescheduleId }, partOfDay: intent.partOfDay || previousPending?.partOfDay };
            reply = `Não encontrei ${time} disponível. Encontrei: ${dayOptions.slice(0, 8).map((option) => `${option.time} com ${option.barberName}`).join(', ')}. Qual prefere?`;
          } else if (time && matchingTime.length > 1) {
            pending = { kind: 'select', booking: { serviceId, styleId, date, rescheduleId: previousPending?.booking?.rescheduleId }, options: matchingTime };
            reply = `${time} está disponível com ${matchingTime.map((option) => option.barberName).join(' e ')}. Qual profissional você prefere?`;
          } else if (time && matchingTime.length === 1) {
            const option = matchingTime[0];
            const selectedService = services.find((item) => item.id === serviceId);
            const selectedStyle = styles.find((item) => item.id === styleId);
            pending = { kind: 'book', booking: { serviceId, styleId, barberId: option.barberId, date, time: option.time, rescheduleId: previousPending?.booking?.rescheduleId } };
            reply = `Encontrei ${selectedService.name}${selectedStyle ? ` · ${selectedStyle.name}` : ''} por ${money(selectedService.priceCents)}, ${selectedService.durationMinutes} min, com ${option.barberName} em ${formatDate(new Date(`${date}T12:00:00`), tenant.timezone)} às ${option.time}. Posso confirmar? Responda “sim” para reservar.`;
          } else {
            pending = { kind: 'select', booking: { serviceId, styleId, barberId, date, rescheduleId: previousPending?.booking?.rescheduleId }, partOfDay: intent.partOfDay };
            reply = `Para ${services.find((item) => item.id === serviceId)?.name} em ${formatDate(new Date(`${date}T12:00:00`), tenant.timezone)}, encontrei: ${dayOptions.slice(0, 8).map((option) => `${option.time} com ${option.barberName}`).join(', ')}. Qual horário você prefere?`;
          }
        }
      }
    }
  }

  const updatedHistory = [...history, { role: 'user', content: message }, { role: 'assistant', content: reply, ...(pending ? { pending } : {}) }];
  const saved = await saveConversation(session, conversation, updatedHistory);
  return NextResponse.json({ conversationId: saved.id, reply });
}

function money(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}