import { redirect } from 'next/navigation';
import BookingWizard from '@/components/booking-wizard';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function NewBookingPage({ searchParams }) {
  const session = await getSession();
  if (!session || session.role !== 'CUSTOMER') redirect('/cliente/login');

  const params = await searchParams;
  const [tenant, services, styles, barbers, initialAppointment] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { id: true, slug: true, name: true, timezone: true } }),
    prisma.service.findMany({ where: { tenantId: session.tenantId, active: true }, orderBy: { name: 'asc' } }),
    prisma.hairStyle.findMany({ where: { tenantId: session.tenantId, active: true }, orderBy: { name: 'asc' } }),
    prisma.barber.findMany({ where: { tenantId: session.tenantId, active: true }, orderBy: { name: 'asc' } }),
    params?.rebook ? prisma.appointment.findFirst({
      where: { id: params.rebook, tenantId: session.tenantId, customer: { userId: session.userId }, status: { in: ['PENDENTE', 'CONFIRMADO'] } },
      include: { service: { select: { id: true } }, barber: { select: { id: true } }, hairStyle: { select: { id: true } } },
    }) : Promise.resolve(null),
  ]);

  if (!tenant) redirect('/cliente/login');
  return <BookingWizard tenant={tenant} services={services} styles={styles} barbers={barbers} initialAppointment={initialAppointment ? {
    id: initialAppointment.id,
    serviceId: initialAppointment.serviceId,
    barberId: initialAppointment.barberId,
    hairStyleId: initialAppointment.hairStyleId,
  } : null} />;
}