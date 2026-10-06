import { redirect } from 'next/navigation';
import '../admin-workspace.css';
import AdminWorkspace from '@/components/admin-workspace';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminManagementPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/admin/login');
  const [tenant, services, barbers, styles, customers, appointments, businessHours, barberHours, gallery, blockedTimes] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: session.tenantId } }),
    prisma.service.findMany({ where: { tenantId: session.tenantId }, orderBy: { name: 'asc' } }),
    prisma.barber.findMany({ where: { tenantId: session.tenantId }, include: { user: { select: { email: true, active: true } } }, orderBy: { name: 'asc' } }),
    prisma.hairStyle.findMany({ where: { tenantId: session.tenantId }, include: { service: { select: { name: true } } }, orderBy: { name: 'asc' } }),
    prisma.customer.findMany({ where: { tenantId: session.tenantId }, include: { user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } }, _count: { select: { appointments: true } } }, orderBy: { user: { name: 'asc' } } }),
    prisma.appointment.findMany({ where: { tenantId: session.tenantId }, include: { customer: { include: { user: { select: { name: true, phone: true, email: true } } } }, barber: { select: { id: true, name: true } }, service: true, hairStyle: true }, orderBy: { startsAt: 'asc' }, take: 500 }),
    prisma.workingHour.findMany({ where: { tenantId: session.tenantId }, orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }] }),
    prisma.barberWorkingHour.findMany({ where: { tenantId: session.tenantId }, include: { barber: { select: { name: true } } }, orderBy: [{ barberId: 'asc' }, { dayOfWeek: 'asc' }] }),
    prisma.gallery.findMany({ where: { tenantId: session.tenantId }, orderBy: { position: 'asc' } }),
    prisma.blockedTime.findMany({ where: { tenantId: session.tenantId, endsAt: { gte: new Date() } }, include: { barber: { select: { name: true } } }, orderBy: { startsAt: 'asc' } }),
  ]);
  return <AdminWorkspace initial={{ tenant, services, barbers, styles, customers, appointments, businessHours, barberHours, gallery, blockedTimes }} />;
}