import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import CustomerAccount from '@/components/customer-account';

export default async function CustomerAccountPage() {
  const session = await getSession();
  if (!session || session.role !== 'CUSTOMER') redirect('/cliente/login');

  const user = await prisma.user.findFirst({
    where: { id: session.userId, tenantId: session.tenantId, role: 'CUSTOMER', active: true },
    include: {
      customerProfile: { include: { preferredBarber: { select: { name: true } } } },
      tenant: { select: { id: true, name: true, timezone: true } },
    },
  });
  if (!user?.customerProfile) redirect('/cliente/login');

  const appointments = await prisma.appointment.findMany({
    where: { tenantId: session.tenantId, customerId: user.customerProfile.id },
    include: { service: { select: { name: true } }, barber: { select: { name: true } }, hairStyle: { select: { name: true } } },
    orderBy: { startsAt: 'desc' },
    take: 12,
  });

  return <CustomerAccount
    user={{ name: user.name, email: user.email, phone: user.phone }}
    tenant={{ name: user.tenant.name, timezone: user.tenant.timezone }}
    appointments={appointments}
    preferredBarber={user.customerProfile.preferredBarber}
  />;
}