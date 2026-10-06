import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z.object({ token: z.string().length(64), password: z.string().min(10).max(128), confirmPassword: z.string() }).refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não coincidem.' });

export async function POST(request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Confira os dados informados.' }, { status: 400 });
  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
  const record = await prisma.passwordResetToken.findFirst({ where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } } });
  if (!record) return NextResponse.json({ error: 'Este link é inválido ou expirou. Solicite uma nova recuperação.' }, { status: 400 });

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (!claimed.count) throw new Error('RESET_TOKEN_ALREADY_USED');
      await transaction.user.update({ where: { id: record.userId }, data: { passwordHash, sessionVersion: { increment: 1 } } });
    });
  } catch {
    return NextResponse.json({ error: 'Este link já foi usado ou expirou. Solicite uma nova recuperação.' }, { status: 409 });
  }
  return NextResponse.json({ success: true, message: 'Senha atualizada. Entre com sua nova senha.' });
}