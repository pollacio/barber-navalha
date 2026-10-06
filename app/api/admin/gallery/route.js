import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const schema = z.object({ title: z.string().trim().min(2).max(100), imageUrl: z.string().url() });

export async function GET() {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const gallery = await prisma.gallery.findMany({ where: { tenantId: session.tenantId }, orderBy: [{ position: 'asc' }, { createdAt: 'desc' }] });
  return NextResponse.json({ gallery });
}

export async function POST(request) {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Informe um título e uma URL de imagem válida.' }, { status: 400 });
  const count = await prisma.gallery.count({ where: { tenantId: session.tenantId } });
  const galleryItem = await prisma.gallery.create({ data: { ...parsed.data, tenantId: session.tenantId, position: count } });
  return NextResponse.json({ galleryItem }, { status: 201 });
}

export async function DELETE(request) {
  const session = await requireSession(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Acesso restrito ao administrador.' }, { status: 403 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Item não encontrado.' }, { status: 400 });
  const result = await prisma.gallery.deleteMany({ where: { id, tenantId: session.tenantId } });
  return result.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 });
}