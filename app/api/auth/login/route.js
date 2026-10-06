import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSessionToken, withSessionCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
  tenantSlug: z.string().trim().min(2).max(80).default('navalha-studio'),
  expectedRole: z.enum(['ADMIN', 'BARBER', 'CUSTOMER']),
});

const dashboardPath = {
  ADMIN: '/',
  BARBER: '/barbeiro',
  CUSTOMER: '/cliente/minha-conta',
};

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Informe um e-mail e senha válidos.' }, { status: 400 });

  const { email, password, tenantSlug, expectedRole } = parsed.data;
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: email.toLowerCase() } },
  });
  if (!user || !user.active || user.role !== expectedRole || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }

  const token = await createSessionToken(user);
  return withSessionCookie(
    NextResponse.json({ user: { id: user.id, name: user.name, role: user.role }, redirectTo: dashboardPath[user.role] }),
    token,
  );
}