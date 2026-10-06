import { prisma } from '@/lib/prisma';

const SLOT_MINUTES = 15;
const MAX_BOOKING_DAYS = 90;

export function isDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function dateParts(date) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

export function dateAtTenantTime(date, minute, timeZone) {
  const { year, month, day } = dateParts(date);
  const hour = Math.floor(minute / 60);
  const minuteOfHour = minute % 60;
  const targetUtc = Date.UTC(year, month - 1, day, hour, minuteOfHour);
  let guess = targetUtc;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(({ type, value }) => [type, value]));
    const localUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    const difference = targetUtc - localUtc;
    guess += difference;
    if (difference === 0) break;
  }

  return new Date(guess);
}

export function formatTenantTime(date, timeZone) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

function minutesToTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function getNextDate(date) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function isWithinBookingWindow(date) {
  const start = new Date(`${date}T00:00:00Z`).valueOf();
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const target = Date.UTC(new Date(`${date}T00:00:00Z`).getUTCFullYear(), new Date(`${date}T00:00:00Z`).getUTCMonth(), new Date(`${date}T00:00:00Z`).getUTCDate());
  return target >= todayUtc && target <= todayUtc + MAX_BOOKING_DAYS * 86400000 && start > 0;
}

export async function getAvailableAppointments({ tenantId, date, serviceId, barberId, excludeAppointmentId }) {
  if (!isDateOnly(date) || !isWithinBookingWindow(date)) return { error: 'Escolha uma data nos próximos 90 dias.' };

  const [tenant, service, barbers] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }),
    prisma.service.findFirst({ where: { id: serviceId, tenantId, active: true } }),
    prisma.barber.findMany({ where: { tenantId, active: true, ...(barberId ? { id: barberId } : {}) }, orderBy: { name: 'asc' } }),
  ]);
  if (!tenant) return { error: 'Barbearia não encontrada.' };
  if (!service) return { error: 'Serviço indisponível.' };
  if (barberId && !barbers.length) return { error: 'Profissional indisponível.' };

  const timeZone = tenant.timezone || 'America/Sao_Paulo';
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const dayStart = dateAtTenantTime(date, 0, timeZone);
  const dayEnd = dateAtTenantTime(getNextDate(date), 0, timeZone);
  const slotsEnd = new Date(dayEnd.getTime() + 86400000);
  const options = [];

  for (const barber of barbers) {
    const [specificHours, tenantHours, blockedTimes, reservations] = await Promise.all([
      prisma.barberWorkingHour.findMany({ where: { tenantId, barberId: barber.id, dayOfWeek: weekday }, orderBy: { startMinute: 'asc' } }),
      prisma.workingHour.findMany({ where: { tenantId, dayOfWeek: weekday, isOpen: true }, orderBy: { startMinute: 'asc' } }),
      prisma.blockedTime.findMany({
        where: {
          tenantId,
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
          OR: [{ barberId: null }, { barberId: barber.id }],
        },
        select: { startsAt: true, endsAt: true },
      }),
      prisma.appointmentSlot.findMany({
        where: { tenantId, barberId: barber.id, startsAt: { gte: dayStart, lt: slotsEnd } },
        select: { startsAt: true, appointmentId: true },
      }),
    ]);

    const hours = specificHours.length ? specificHours.filter((entry) => entry.isAvailable) : tenantHours;
    const busySlots = new Set(reservations
      .filter((reservation) => reservation.appointmentId !== excludeAppointmentId)
      .map((reservation) => reservation.startsAt.getTime()));

    for (const shift of hours) {
      for (let startMinute = shift.startMinute; startMinute + service.durationMinutes <= shift.endMinute; startMinute += SLOT_MINUTES) {
        const startsAt = dateAtTenantTime(date, startMinute, timeZone);
        const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60000);
        if (startsAt <= new Date()) continue;

        const overlappingBlock = blockedTimes.some((blocked) => blocked.startsAt < endsAt && blocked.endsAt > startsAt);
        if (overlappingBlock) continue;

        const slotCount = Math.ceil(service.durationMinutes / SLOT_MINUTES);
        let isBusy = false;
        for (let index = 0; index < slotCount; index += 1) {
          const slotTime = startsAt.getTime() + index * SLOT_MINUTES * 60000;
          if (busySlots.has(slotTime)) {
            isBusy = true;
            break;
          }
        }
        if (!isBusy) options.push({ time: minutesToTime(startMinute), barberId: barber.id, barberName: barber.name });
      }
    }
  }

  return { options: options.sort((a, b) => a.time.localeCompare(b.time) || a.barberName.localeCompare(b.barberName)), timeZone };
}

export function getReservationSlots(startsAt, durationMinutes) {
  const count = Math.ceil(durationMinutes / SLOT_MINUTES);
  return Array.from({ length: count }, (_, index) => new Date(startsAt.getTime() + index * SLOT_MINUTES * 60000));
}

export async function findAppointmentOverlapping({ tenantId, barberId, startsAt, endsAt }) {
  const earliestStart = new Date(startsAt.getTime() - 8 * 60 * 60 * 1000);
  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      status: { in: ['PENDENTE', 'CONFIRMADO'] },
      startsAt: { gte: earliestStart, lt: endsAt },
      ...(barberId ? { barberId } : {}),
    },
    select: { id: true, startsAt: true, durationMinutes: true },
  });
  return appointments.find((appointment) => appointment.startsAt.getTime() + appointment.durationMinutes * 60000 > startsAt.getTime()) || null;
}