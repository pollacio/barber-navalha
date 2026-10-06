import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const protectedCustomerPaths = ['/cliente/minha-conta', '/cliente/meus-agendamentos', '/cliente/novo-agendamento'];

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const needsAdmin = pathname === '/' || (pathname.startsWith('/admin') && pathname !== '/admin/login');
  const needsBarber = (pathname === '/barbeiro' || pathname.startsWith('/barbeiro/agenda')) && pathname !== '/barbeiro/login';
  const needsCustomer = protectedCustomerPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!needsAdmin && !needsBarber && !needsCustomer) return NextResponse.next();

  const token = request.cookies.get('navalha_session')?.value;
  if (!token) {
    const loginPath = needsAdmin ? '/admin/login' : needsBarber ? '/barbeiro/login' : '/cliente/login';
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  let role;
  try {
    const key = new TextEncoder().encode(process.env.SESSION_SECRET || 'local-development-only-change-before-deploy-2026');
    const { payload } = await jwtVerify(token, key);
    role = payload.role;
  } catch {
    const response = NextResponse.redirect(new URL('/cliente/login', request.url));
    response.cookies.delete('navalha_session');
    return response;
  }

  if (needsAdmin && role !== 'ADMIN') {
    return NextResponse.redirect(new URL(role === 'BARBER' ? '/barbeiro' : '/cliente/minha-conta', request.url));
  }
  if (needsBarber && role !== 'BARBER') {
    return NextResponse.redirect(new URL(role === 'ADMIN' ? '/' : '/cliente/minha-conta', request.url));
  }
  if (needsCustomer && role !== 'CUSTOMER') {
    return NextResponse.redirect(new URL(role === 'ADMIN' ? '/' : '/barbeiro', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/admin/:path*', '/barbeiro/:path*', '/cliente/minha-conta/:path*', '/cliente/meus-agendamentos/:path*', '/cliente/novo-agendamento/:path*'],
};