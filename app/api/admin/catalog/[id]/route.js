import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request, { params }) {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  if (!['service', 'barber', 'style'].includes(kind)) return NextResponse.json({ error: 'Tipo de cadastro inválido.' }, { status: 400 });

  if (kind === 'service') {
    const parsed = z.object({ name: z.string().trim().min(2).max(100).optional(), description: z.string().trim().max(500).optional(), priceCents: z.number().int().min(0).max(1000000).optional(), durationMinutes: z.number().int().min(5).max(480).optional(), imageUrl: z.string().url().nullable().optional(), active: z.boolean().optional() }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Dados do serviço inválidos.' }, { status: 400 });
    const result = await prisma.service.updateMany({ where: { id, tenantId: session.tenantId }, data: parsed.data });
    return result.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });
  }

  if (kind === 'barber') {
    const parsed = z.object({ name: z.string().trim().min(2).max(100).optional(), bio: z.string().trim().max(500).optional(), specialties: z.string().trim().max(300).optional(), active: z.boolean().optional() }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Dados do barbeiro inválidos.' }, { status: 400 });
    const barber = await prisma.barber.findFirst({ where: { id, tenantId: session.tenantId }, select: { userId: true } });
    if (!barber) return NextResponse.json({ error: 'Barbeiro não encontrado.' }, { status: 404 });
    await prisma.$transaction(async (transaction) => {
      await transaction.barber.updateMany({ where: { id, tenantId: session.tenantId }, data: parsed.data });
      if (barber.userId && parsed.data.name) await transaction.user.update({ where: { id: barber.userId }, data: { name: parsed.data.name } });
      if (barber.userId && parsed.data.active !== undefined) await transaction.user.update({ where: { id: barber.userId }, data: { active: parsed.data.active } });
    });
    return NextResponse.json({ success: true });
  }

  const parsed = z.object({ name: z.string().trim().min(2).max(100).optional(), description: z.string().trim().max(500).optional(), serviceId: z.string().nullable().optional(), imageUrl: z.string().url().nullable().optional(), active: z.boolean().optional() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Dados do estilo inválidos.' }, { status: 400 });
  const result = await prisma.hairStyle.updateMany({ where: { id, tenantId: session.tenantId }, data: parsed.data });
  return result.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Estilo não encontrado.' }, { status: 404 });
}

export async function DELETE(request, { params }) {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const { id } = await params;
  const kind = new URL(request.url).searchParams.get('kind');
  if (!['service', 'barber', 'style'].includes(kind)) return NextResponse.json({ error: 'Tipo de cadastro inválido.' }, { status: 400 });
  const model = kind === 'service' ? prisma.service : kind === 'barber' ? prisma.barber : prisma.hairStyle;
  const result = await model.updateMany({ where: { id, tenantId: session.tenantId }, data: { active: false } });
  if (kind === 'barber') {
    const barber = await prisma.barber.findFirst({ where: { id, tenantId: session.tenantId }, select: { userId: true } });
    if (barber?.userId) await prisma.user.update({ where: { id: barber.userId }, data: { active: false } });
  }
  return result.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 });
}