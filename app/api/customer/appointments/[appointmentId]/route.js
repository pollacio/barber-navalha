import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request, { params }) {
  const session = await getSession();
  if (!session || session.role !== 'CUSTOMER') return NextResponse.json({ error: 'Faça login como cliente.' }, { status: 401 });
  const { appointmentId } = await params;
  const { action } = await request.json().catch(() => ({}));
  if (action !== 'cancel') return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId: session.tenantId, customer: { userId: session.userId } },
    include: { tenant: { select: { cancelNoticeHours: true } } },
  });
  if (!appointment) return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 });
  if (!['PENDENTE', 'CONFIRMADO'].includes(appointment.status)) return NextResponse.json({ error: 'Este agendamento não pode ser cancelado.' }, { status: 409 });

  const cutoff = appointment.startsAt.getTime() - appointment.tenant.cancelNoticeHours * 60 * 60 * 1000;
  if (Date.now() > cutoff) return NextResponse.json({ error: `Cancelamentos precisam ser feitos com ${appointment.tenant.cancelNoticeHours} horas de antecedência.` }, { status: 409 });

  await prisma.$transaction([
    prisma.appointment.update({ where: { id: appointment.id }, data: { status: 'CANCELADO' } }),
    prisma.appointmentSlot.deleteMany({ where: { appointmentId: appointment.id } }),
  ]);
  return NextResponse.json({ success: true });
}