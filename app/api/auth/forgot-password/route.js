import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z.object({ email: z.string().trim().email().max(254), tenantSlug: z.string().trim().default('navalha-studio') });
const genericReply = 'Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes.';

export async function POST(request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { slug: parsed.data.tenantSlug }, select: { id: true, name: true } });
  if (!tenant) return NextResponse.json({ message: genericReply });
  const user = await prisma.user.findFirst({ where: { tenantId: tenant.id, email: parsed.data.email.toLowerCase(), role: 'CUSTOMER', active: true }, select: { id: true, email: true } });
  if (!user || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return NextResponse.json({ message: genericReply });

  const recent = await prisma.passwordResetToken.findFirst({ where: { tenantId: tenant.id, userId: user.id, createdAt: { gte: new Date(Date.now() - 60000) } } });
  if (recent) return NextResponse.json({ message: genericReply });

  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await prisma.passwordResetToken.updateMany({ where: { tenantId: tenant.id, userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.passwordResetToken.create({ data: { tenantId: tenant.id, userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const resetUrl = `${origin}/cliente/redefinir-senha?token=${token}`;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: `Redefina sua senha · ${tenant.name}`,
      html: `<p>Recebemos um pedido para redefinir a senha da sua conta na ${tenant.name}.</p><p><a href="${resetUrl}">Criar uma nova senha</a></p><p>O link expira em 30 minutos e pode ser usado uma única vez. Se você não fez este pedido, ignore esta mensagem.</p>`,
    });
  } catch (error) {
    console.error('Password reset email failed:', error.message);
  }

  return NextResponse.json({ message: genericReply });
}