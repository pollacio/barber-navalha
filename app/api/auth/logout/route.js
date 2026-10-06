import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
  return clearSessionCookie(NextResponse.json({ redirectTo: '/cliente/login' }));
}