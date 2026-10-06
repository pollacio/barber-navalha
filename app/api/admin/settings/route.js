import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(24).optional(),
  email: z.string().trim().email().max(254).or(z.literal('')).optional(),
  address: z.string().trim().max(240).optional(),
  instagram: z.string().trim().max(100).optional(),
  cancelNoticeHours: z.number().int().min(0).max(168).optional(),
  timezone: z.string().trim().max(80).optional(),
  aiEnabled: z.boolean().optional(),
  aiInstructions: z.string().trim().max(2000).optional(),
});

export async function GET() {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId } });
  return NextResponse.json({ tenant });
}

export async function PATCH(request) {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return NextResponse.json({ error: 'Confira as informações da barbearia.' }, { status: 400 });
  const tenant = await prisma.tenant.update({ where: { id: session.tenantId }, data: parsed.data });
  return NextResponse.json({ tenant });
}