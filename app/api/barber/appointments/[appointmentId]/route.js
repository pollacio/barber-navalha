import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const updateSchema = z.object({ action: z.enum(['confirm', 'complete', 'cancel', 'no-show']) });

export async function PATCH(request, { params }) {
  const session = await requireSession(['BARBER']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao barbeiro.' }, { status: 403 });
  const { appointmentId } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });

  const barber = await prisma.barber.findFirst({ where: { tenantId: session.tenantId, userId: session.userId, active: true } });
  if (!barber) return NextResponse.json({ error: 'Perfil de barbeiro não encontrado.' }, { status: 404 });
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, tenantId: session.tenantId, barberId: barber.id } });
  if (!appointment) return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 });

  const statusMap = { confirm: 'CONFIRMADO', complete: 'CONCLUIDO', cancel: 'CANCELADO', 'no-show': 'NAO_COMPARECEU' };
  const nextStatus = statusMap[parsed.data.action];
  const allowed = parsed.data.action === 'confirm'
    ? ['PENDENTE']
    : parsed.data.action === 'complete'
      ? ['PENDENTE', 'CONFIRMADO']
      : ['PENDENTE', 'CONFIRMADO'];
  if (!allowed.includes(appointment.status)) return NextResponse.json({ error: 'Este status não pode ser alterado.' }, { status: 409 });

  const updated = await prisma.$transaction(async (transaction) => {
    const result = await transaction.appointment.update({ where: { id: appointment.id }, data: { status: nextStatus } });
    if (parsed.data.action === 'cancel') await transaction.appointmentSlot.deleteMany({ where: { appointmentId: appointment.id } });
    if (parsed.data.action === 'complete') await transaction.payment.upsert({
      where: { appointmentId: appointment.id },
      update: { status: 'PAGO' },
      create: { tenantId: session.tenantId, appointmentId: appointment.id, amountCents: appointment.priceCents, status: 'PAGO' },
    });
    return result;
  });
  return NextResponse.json({ appointment: updated });
}