import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const serviceSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).default(''), priceCents: z.coerce.number().int().min(0).max(1000000), durationMinutes: z.coerce.number().int().min(5).max(480), imageUrl: z.string().url().optional().or(z.literal('')) });
const barberSchema = z.object({ name: z.string().trim().min(2).max(100), bio: z.string().trim().max(500).default(''), specialties: z.string().trim().max(300).default(''), email: z.string().email().optional().or(z.literal('')), password: z.string().min(10).optional() }).refine((data) => Boolean(data.email) === Boolean(data.password), { message: 'Informe e-mail e senha para criar um acesso de barbeiro.' });
const styleSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).default(''), serviceId: z.string().optional().or(z.literal('')), imageUrl: z.string().url().optional().or(z.literal('')) });

export async function GET() {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });

  const [services, barbers, styles, customers, appointments] = await Promise.all([
    prisma.service.findMany({ where: { tenantId: session.tenantId }, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
    prisma.barber.findMany({ where: { tenantId: session.tenantId }, include: { user: { select: { email: true, active: true } } }, orderBy: { name: 'asc' } }),
    prisma.hairStyle.findMany({ where: { tenantId: session.tenantId }, include: { service: { select: { name: true } } }, orderBy: { name: 'asc' } }),
    prisma.customer.findMany({ where: { tenantId: session.tenantId }, include: { user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } }, appointments: { select: { id: true } } }, orderBy: { user: { name: 'asc' } } }),
    prisma.appointment.findMany({ where: { tenantId: session.tenantId }, include: { service: { select: { name: true } }, barber: { select: { name: true } }, customer: { include: { user: { select: { name: true, phone: true, email: true } } } } }, orderBy: { startsAt: 'asc' }, take: 300 }),
  ]);
  return NextResponse.json({ services, barbers, styles, customers, appointments });
}

export async function POST(request) {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const payload = await request.json().catch(() => null);
  if (!payload || !['service', 'barber', 'style'].includes(payload.kind)) return NextResponse.json({ error: 'Tipo de cadastro inválido.' }, { status: 400 });

  if (payload.kind === 'service') {
    const parsed = serviceSchema.safeParse(payload);
    if (!parsed.success) return NextResponse.json({ error: 'Confira nome, valor e duração do serviço.' }, { status: 400 });
    try {
      const service = await prisma.service.create({ data: { ...parsed.data, tenantId: session.tenantId, imageUrl: parsed.data.imageUrl || null } });
      return NextResponse.json({ service }, { status: 201 });
    } catch (error) {
      if (error.code === 'P2002') return NextResponse.json({ error: 'Já existe um serviço com esse nome.' }, { status: 409 });
      throw error;
    }
  }

  if (payload.kind === 'style') {
    const parsed = styleSchema.safeParse(payload);
    if (!parsed.success) return NextResponse.json({ error: 'Confira nome e descrição do estilo.' }, { status: 400 });
    if (parsed.data.serviceId && !await prisma.service.findFirst({ where: { id: parsed.data.serviceId, tenantId: session.tenantId } })) return NextResponse.json({ error: 'Serviço não pertence a esta barbearia.' }, { status: 400 });
    try {
      const style = await prisma.hairStyle.create({ data: { ...parsed.data, tenantId: session.tenantId, serviceId: parsed.data.serviceId || null, imageUrl: parsed.data.imageUrl || null } });
      return NextResponse.json({ style }, { status: 201 });
    } catch (error) {
      if (error.code === 'P2002') return NextResponse.json({ error: 'Já existe um estilo com esse nome.' }, { status: 409 });
      throw error;
    }
  }

  const parsed = barberSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Confira o nome e os dados do barbeiro.' }, { status: 400 });
  const { email, password, ...barberData } = parsed.data;
  try {
    const barber = email && password
      ? await prisma.user.create({
        data: {
          tenantId: session.tenantId,
          email: email.toLowerCase(),
          name: barberData.name,
          passwordHash: await bcrypt.hash(password, 12),
          role: 'BARBER',
          barberProfile: { create: { tenantId: session.tenantId, ...barberData } },
        },
        include: { barberProfile: true },
      }).then((user) => user.barberProfile)
      : await prisma.barber.create({ data: { tenantId: session.tenantId, ...barberData } });
    return NextResponse.json({ barber }, { status: 201 });
  } catch (error) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Já existe um barbeiro ou e-mail com esses dados.' }, { status: 409 });
    throw error;
  }
}