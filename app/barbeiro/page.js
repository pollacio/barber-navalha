import { redirect } from 'next/navigation';
import './barber.css';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import BarberDashboard from '@/components/barber-dashboard';

export default async function BarberDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== 'BARBER') redirect('/barbeiro/login');
  const barber = await prisma.barber.findFirst({ where: { tenantId: session.tenantId, userId: session.userId, active: true } });
  if (!barber) redirect('/barbeiro/login');
  const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { name: true, timezone: true } });
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  const appointments = await prisma.appointment.findMany({
    where: { tenantId: session.tenantId, barberId: barber.id, startsAt: { gte: new Date(now.setHours(0, 0, 0, 0)), lt: end }, status: { not: 'CANCELADO' } },
    include: { customer: { include: { user: { select: { name: true, phone: true, email: true } } } }, service: true },
    orderBy: { startsAt: 'asc' },
  });
  const blockedTimes = await prisma.blockedTime.findMany({ where: { tenantId: session.tenantId, barberId: barber.id, startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' }, take: 10 });
  return <BarberDashboard barber={{ id: barber.id, name: barber.name, specialties: barber.specialties }} tenant={tenant} appointments={appointments} blockedTimes={blockedTimes} />;
}