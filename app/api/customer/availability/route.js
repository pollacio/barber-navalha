import { NextResponse } from 'next/server';
import { getAvailableAppointments } from '@/lib/scheduling';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  const params = request.nextUrl.searchParams;
  const tenantSlug = params.get('tenant') || 'navalha-studio';
  const date = params.get('date') || '';
  const month = params.get('month') || '';
  const serviceId = params.get('serviceId') || '';
  const barberId = params.get('barberId') || undefined;
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) return NextResponse.json({ error: 'Barbearia não encontrada.' }, { status: 404 });

  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'Mês inválido.', availableDates: [] }, { status: 400 });
    const [year, monthNumber] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const dates = Array.from({ length: daysInMonth }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
    const availability = await Promise.all(dates.map((day) => getAvailableAppointments({ tenantId: tenant.id, date: day, serviceId, barberId })));
    return NextResponse.json({ availableDates: dates.filter((_, index) => availability[index].options?.length > 0) });
  }

  const result = await getAvailableAppointments({ tenantId: tenant.id, date, serviceId, barberId });
  if (result.error) return NextResponse.json({ error: result.error, options: [] }, { status: 400 });
  return NextResponse.json(result);
}