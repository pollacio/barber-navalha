import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findAppointmentOverlapping } from '@/lib/scheduling';

const schema = z.object({ barberId: z.string().optional().nullable(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), reason: z.string().trim().max(160).default('Bloqueio da barbearia') });

export async function GET() {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const blockedTimes = await prisma.blockedTime.findMany({ where: { tenantId: session.tenantId, endsAt: { gte: new Date() } }, include: { barber: { select: { name: true } } }, orderBy: { startsAt: 'asc' } });
  return NextResponse.json({ blockedTimes });
}

export async function POST(request) {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) return NextResponse.json({ error: 'Confira o intervalo do bloqueio.' }, { status: 400 });
  if (parsed.data.barberId && !await prisma.barber.findFirst({ where: { id: parsed.data.barberId, tenantId: session.tenantId } })) return NextResponse.json({ error: 'Barbeiro não encontrado.' }, { status: 404 });
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  const overlapping = await findAppointmentOverlapping({ tenantId: session.tenantId, barberId: parsed.data.barberId || undefined, startsAt, endsAt });
  if (overlapping) return NextResponse.json({ error: 'Há um atendimento neste intervalo. Cancele ou reagende antes de bloquear.' }, { status: 409 });
  const blockedTime = await prisma.blockedTime.create({ data: { tenantId: session.tenantId, ...parsed.data, barberId: parsed.data.barberId || null, startsAt, endsAt } });
  return NextResponse.json({ blockedTime }, { status: 201 });
}

export async function DELETE(request) {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Informe o bloqueio.' }, { status: 400 });
  const result = await prisma.blockedTime.deleteMany({ where: { id, tenantId: session.tenantId } });
  return result.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Bloqueio não encontrado.' }, { status: 404 });
}