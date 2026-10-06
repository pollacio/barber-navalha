import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSessionToken, withSessionCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(8).max(24),
  password: z.string().min(10).max(128),
  confirmPassword: z.string(),
  acceptTerms: z.literal(true),
  tenantSlug: z.string().trim().min(2).max(80).default('navalha-studio'),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'As senhas não coincidem.',
});

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Confira os dados informados.' }, { status: 400 });
  }

  const { name, email, phone, password, tenantSlug } = parsed.data;
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return NextResponse.json({ error: 'Barbearia não encontrada.' }, { status: 404 });

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name,
        email: email.toLowerCase(),
        phone,
        passwordHash,
        role: 'CUSTOMER',
        customerProfile: { create: { tenantId: tenant.id } },
      },
      select: { id: true, name: true, email: true, tenantId: true, role: true },
    });

    const token = await createSessionToken(user);
    return withSessionCookie(NextResponse.json({ user, redirectTo: '/cliente/minha-conta' }, { status: 201 }), token);
  } catch (error) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Este e-mail já possui uma conta nesta barbearia.' }, { status: 409 });
    console.error('Customer registration failed:', error.message);
    return NextResponse.json({ error: 'Não foi possível criar sua conta.' }, { status: 500 });
  }
}