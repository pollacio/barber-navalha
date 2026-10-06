import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { dateAtTenantTime, getAvailableAppointments, getReservationSlots, isDateOnly } from '@/lib/scheduling';

export class BookingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function reserveCustomerAppointment({ session, serviceId, styleId, barberId, date, time, rescheduleId, status = 'PENDENTE' }) {
  if (!isDateOnly(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) throw new BookingError('Confira a data e o horário.');
  const [customer, tenant, service] = await Promise.all([
    prisma.customer.findFirst({ where: { userId: session.userId, tenantId: session.tenantId } }),
    prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { timezone: true, cancelNoticeHours: true } }),
    prisma.service.findFirst({ where: { id: serviceId, tenantId: session.tenantId, active: true } }),
  ]);
  if (!customer || !tenant || !service) throw new BookingError('Não foi possível validar o agendamento.');

  const existingAppointment = rescheduleId
    ? await prisma.appointment.findFirst({
      where: { id: rescheduleId, tenantId: session.tenantId, customerId: customer.id, status: { in: ['PENDENTE', 'CONFIRMADO'] } },
    })
    : null;
  if (rescheduleId && !existingAppointment) throw new BookingError('Agendamento não pode ser reagendado.', 404);
  if (existingAppointment && Date.now() > existingAppointment.startsAt.getTime() - tenant.cancelNoticeHours * 60 * 60 * 1000) {
    throw new BookingError(`Reagendamentos precisam ser feitos com ${tenant.cancelNoticeHours} horas de antecedência.`, 409);
  }

  const availability = await getAvailableAppointments({
    tenantId: session.tenantId,
    date,
    serviceId,
    barberId: barberId || existingAppointment?.barberId || undefined,
    excludeAppointmentId: existingAppointment?.id,
  });
  if (availability.error) throw new BookingError(availability.error);
  const slot = availability.options.find((option) => option.time === time);
  if (!slot) throw new BookingError('Esse horário acabou de ficar indisponível. Escolha outro.', 409);

  if (styleId && !await prisma.hairStyle.findFirst({ where: { id: styleId, tenantId: session.tenantId, active: true } })) {
    throw new BookingError('Estilo indisponível.');
  }

  const [hour, minute] = time.split(':').map(Number);
  const startsAt = dateAtTenantTime(date, hour * 60 + minute, tenant.timezone);
  const reservationSlots = getReservationSlots(startsAt, service.durationMinutes);
  const code = `NV-${randomUUID().slice(0, 8).toUpperCase()}`;
  try {
    const appointment = await prisma.$transaction(async (transaction) => {
      if (existingAppointment) await transaction.appointmentSlot.deleteMany({ where: { appointmentId: existingAppointment.id } });
      const data = {
        code,
        barberId: slot.barberId,
        serviceId: service.id,
        hairStyleId: styleId || null,
        startsAt,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
        status,
        slots: { create: reservationSlots.map((slotTime) => ({ tenantId: session.tenantId, barberId: slot.barberId, startsAt: slotTime })) },
      };
      return existingAppointment
        ? transaction.appointment.update({ where: { id: existingAppointment.id }, data, include: { barber: true, service: true, hairStyle: true } })
        : transaction.appointment.create({ data: { ...data, tenantId: session.tenantId, customerId: customer.id }, include: { barber: true, service: true, hairStyle: true } });
    });
    return { appointment, rescheduled: Boolean(existingAppointment) };
  } catch (error) {
    if (error.code === 'P2002' || error.code === 'P2034') throw new BookingError('Esse horário acabou de ser reservado. Escolha outra opção.', 409);
    console.error('Appointment reservation failed:', error.message);
    throw new BookingError('Não foi possível confirmar o agendamento.', 500);
  }
}