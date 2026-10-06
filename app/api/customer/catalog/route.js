import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  const tenantSlug = request.nextUrl.searchParams.get('tenant') || 'navalha-studio';
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true, name: true, timezone: true } });
  if (!tenant) return NextResponse.json({ error: 'Barbearia não encontrada.' }, { status: 404 });

  const [services, styles, barbers] = await Promise.all([
    prisma.service.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, description: true, priceCents: true, durationMinutes: true, imageUrl: true } }),
    prisma.hairStyle.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, description: true, imageUrl: true, serviceId: true } }),
    prisma.barber.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, bio: true, specialties: true, rating: true, reviewCount: true } }),
  ]);
  return NextResponse.json({ tenant, services, styles, barbers });
}