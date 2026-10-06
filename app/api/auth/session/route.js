import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  const user = await prisma.user.findFirst({
    where: { id: session.userId, tenantId: session.tenantId, active: true },
    select: { id: true, name: true, email: true, phone: true, photoUrl: true, role: true },
  });
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user, tenantId: session.tenantId });
}