import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  scope: z.enum(['business', 'barber']),
  barberId: z.string().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isOpen: z.boolean().default(true),
});

function toMinutes(value) { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; }

export async function GET() {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const [businessHours, barberHours, barbers] = await Promise.all([
    prisma.workingHour.findMany({ where: { tenantId: session.tenantId }, orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }] }),
    prisma.barberWorkingHour.findMany({ where: { tenantId: session.tenantId }, include: { barber: { select: { name: true } } }, orderBy: [{ barberId: 'asc' }, { dayOfWeek: 'asc' }] }),
    prisma.barber.findMany({ where: { tenantId: session.tenantId, active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  return NextResponse.json({ businessHours, barberHours, barbers });
}

export async function POST(request) {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Confira o dia e o intervalo de funcionamento.' }, { status: 400 });
  const { scope, barberId, dayOfWeek, start, end, isOpen } = parsed.data;
  const startMinute = toMinutes(start);
  const endMinute = toMinutes(end);
  if (isOpen && endMinute <= startMinute) return NextResponse.json({ error: 'O horário final deve ser depois do horário inicial.' }, { status: 400 });

  if (scope === 'barber') {
    if (!barberId || !await prisma.barber.findFirst({ where: { id: barberId, tenantId: session.tenantId, active: true } })) return NextResponse.json({ error: 'Barbeiro não encontrado.' }, { status: 404 });
    await prisma.$transaction(async (transaction) => {
      await transaction.barberWorkingHour.deleteMany({ where: { tenantId: session.tenantId, barberId, dayOfWeek } });
      await transaction.barberWorkingHour.create({ data: { tenantId: session.tenantId, barberId, dayOfWeek, startMinute: isOpen ? startMinute : 0, endMinute: isOpen ? endMinute : 0, isAvailable: isOpen } });
    });
  } else {
    await prisma.$transaction(async (transaction) => {
      await transaction.workingHour.deleteMany({ where: { tenantId: session.tenantId, dayOfWeek } });
      await transaction.workingHour.create({ data: { tenantId: session.tenantId, dayOfWeek, startMinute, endMinute: isOpen ? endMinute : startMinute, isOpen } });
    });
  }
  return NextResponse.json({ success: true });
}