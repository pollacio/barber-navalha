import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { BookingError, reserveCustomerAppointment } from '@/lib/appointments';
import { prisma } from '@/lib/prisma';

const bookingSchema = z.object({
  serviceId: z.string().min(1),
  styleId: z.string().min(1).optional().nullable(),
  barberId: z.string().min(1).optional().nullable(),
  date: z.string(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  rescheduleId: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'CUSTOMER') return NextResponse.json({ error: 'Faça login como cliente.' }, { status: 401 });

  const customer = await prisma.customer.findFirst({ where: { userId: session.userId, tenantId: session.tenantId } });
  if (!customer) return NextResponse.json({ error: 'Perfil de cliente não encontrado.' }, { status: 404 });
  const appointments = await prisma.appointment.findMany({
    where: { tenantId: session.tenantId, customerId: customer.id },
    include: { service: true, barber: true, hairStyle: true },
    orderBy: { startsAt: 'desc' },
  });

  return NextResponse.json({ appointments });
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'CUSTOMER') return NextResponse.json({ error: 'Faça login como cliente.' }, { status: 401 });

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const parsed = bookingSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Confira o serviço, a data e o horário.' }, { status: 400 });
  try {
    const result = await reserveCustomerAppointment({ session, ...parsed.data });
    return NextResponse.json({ appointment: result.appointment }, { status: result.rescheduled ? 200 : 201 });
  } catch (error) {
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}