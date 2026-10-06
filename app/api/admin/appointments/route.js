import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const statusSchema = z.object({ status: z.enum(['PENDENTE', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU']) });

export async function GET(request) {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');
  const appointments = await prisma.appointment.findMany({
    where: { tenantId: session.tenantId, ...(from || to ? { startsAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lt: new Date(to) } : {}) } } : {}) },
    include: { customer: { include: { user: { select: { name: true, phone: true, email: true } } } }, barber: { select: { id: true, name: true } }, service: true, hairStyle: true },
    orderBy: { startsAt: 'asc' },
    take: 500,
  });
  return NextResponse.json({ appointments });
}

export async function PATCH(request) {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const payload = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(payload);
  if (!parsed.success || typeof payload.id !== 'string') return NextResponse.json({ error: 'Confira o agendamento e o status.' }, { status: 400 });
  const appointment = await prisma.appointment.findFirst({ where: { id: payload.id, tenantId: session.tenantId } });
  if (!appointment) return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 });
  const activeStatuses = ['PENDENTE', 'CONFIRMADO'];
  if (appointment.status !== parsed.data.status && !activeStatuses.includes(appointment.status)) return NextResponse.json({ error: 'Agendamentos encerrados não podem ser reabertos. Crie uma nova reserva.' }, { status: 409 });
  await prisma.$transaction(async (transaction) => {
    await transaction.appointment.update({ where: { id: appointment.id }, data: { status: parsed.data.status } });
    if (parsed.data.status === 'CANCELADO') await transaction.appointmentSlot.deleteMany({ where: { appointmentId: appointment.id } });
    if (parsed.data.status === 'CONCLUIDO') await transaction.payment.upsert({
      where: { appointmentId: appointment.id },
      update: { status: 'PAGO' },
      create: { tenantId: session.tenantId, appointmentId: appointment.id, amountCents: appointment.priceCents, status: 'PAGO' },
    });
  });
  return NextResponse.json({ success: true });
}