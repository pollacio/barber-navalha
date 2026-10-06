import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findAppointmentOverlapping } from '@/lib/scheduling';

const blockSchema = z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime(), reason: z.string().trim().max(160).default('Bloqueio do barbeiro') });

export async function POST(request) {
  const session = await requireSession(['BARBER']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao barbeiro.' }, { status: 403 });
  const parsed = blockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) return NextResponse.json({ error: 'Confira a data e o horário do bloqueio.' }, { status: 400 });

  const barber = await prisma.barber.findFirst({ where: { tenantId: session.tenantId, userId: session.userId, active: true } });
  if (!barber) return NextResponse.json({ error: 'Perfil de barbeiro não encontrado.' }, { status: 404 });
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  const existing = await findAppointmentOverlapping({ tenantId: session.tenantId, barberId: barber.id, startsAt, endsAt });
  if (existing) return NextResponse.json({ error: 'Há um atendimento neste intervalo. Cancele ou reagende antes de bloquear.' }, { status: 409 });
  const blockedTime = await prisma.blockedTime.create({ data: { tenantId: session.tenantId, barberId: barber.id, startsAt, endsAt, reason: parsed.data.reason } });
  return NextResponse.json({ blockedTime }, { status: 201 });
}