import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';

const COOKIE_NAME = 'navalha_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function getSigningKey() {
  const value = process.env.SESSION_SECRET;
  if (!value && process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET must be configured in production.');
  return new TextEncoder().encode(value || 'local-development-only-change-before-deploy-2026');
}

export async function createSessionToken(user) {
  return new SignJWT({ tenantId: user.tenantId, role: user.role, sessionVersion: user.sessionVersion || 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(getSigningKey());
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSigningKey());
    if (!payload.sub || !payload.tenantId || !['ADMIN', 'BARBER', 'CUSTOMER'].includes(payload.role)) return null;
    const user = await prisma.user.findFirst({ where: { id: payload.sub, tenantId: payload.tenantId, active: true }, select: { sessionVersion: true } });
    if (!user || user.sessionVersion !== (payload.sessionVersion || 0)) return null;
    return { userId: payload.sub, tenantId: payload.tenantId, role: payload.role };
  } catch {
    return null;
  }
}

export async function requireSession(roles = []) {
  const session = await getSession();
  if (!session || (roles.length && !roles.includes(session.role))) return null;
  return session;
}

export function withSessionCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_SECONDS,
  });
  return response;
}

export function clearSessionCookie(response) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export function jsonUnauthorized() {
  return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
}