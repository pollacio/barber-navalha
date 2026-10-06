import { redirect } from 'next/navigation';
import CustomerAppointments from '@/components/customer-appointments';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function CustomerAppointmentsPage() {
  const session = await getSession();
  if (!session || session.role !== 'CUSTOMER') redirect('/cliente/login');
  const customer = await prisma.customer.findFirst({ where: { userId: session.userId, tenantId: session.tenantId } });
  const [appointments, tenant] = await Promise.all([
    customer ? prisma.appointment.findMany({
      where: { tenantId: session.tenantId, customerId: customer.id },
      include: { service: { select: { name: true } }, barber: { select: { name: true } }, hairStyle: { select: { name: true } } },
      orderBy: { startsAt: 'asc' },
    }) : [],
    prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { timezone: true, cancelNoticeHours: true } }),
  ]);
  return <CustomerAppointments appointments={appointments} timezone={tenant?.timezone || 'America/Sao_Paulo'} cancellationNoticeHours={tenant?.cancelNoticeHours || 4} />;
}