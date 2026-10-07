import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: '.env.local' });
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const tenantName = process.env.BOOTSTRAP_TENANT_NAME?.trim();
  const tenantSlug = process.env.BOOTSTRAP_TENANT_SLUG?.trim().toLowerCase();
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!tenantName || !tenantSlug || !adminName || !adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error('Configure BOOTSTRAP_TENANT_NAME, BOOTSTRAP_TENANT_SLUG, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD (mínimo 12 caracteres).');
  }

  const existingTenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, include: { users: { where: { role: 'ADMIN' }, select: { id: true } } } });
  if (existingTenant?.users.length) throw new Error('Esta barbearia já possui um administrador. O bootstrap não pode ser repetido.');

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const result = await prisma.$transaction(async (transaction) => {
    const tenant = existingTenant || await transaction.tenant.create({ data: { slug: tenantSlug, name: tenantName } });
    const admin = await transaction.user.create({
      data: { tenantId: tenant.id, name: adminName, email: adminEmail, passwordHash, role: 'ADMIN' },
      select: { name: true, email: true },
    });

    const services = [
      { name: 'Corte degradê', description: 'Degradê personalizado com acabamento na navalha.', priceCents: 6500, durationMinutes: 45 },
      { name: 'Corte clássico', description: 'Corte clássico com finalização profissional.', priceCents: 5500, durationMinutes: 40 },
      { name: 'Barba completa', description: 'Modelagem, toalha quente e acabamento.', priceCents: 4500, durationMinutes: 30 },
      { name: 'Corte + barba', description: 'Corte completo com barba e toalha quente.', priceCents: 9500, durationMinutes: 75 },
      { name: 'Corte infantil', description: 'Corte para crianças com atenção especial.', priceCents: 5000, durationMinutes: 40 },
      { name: 'Sobrancelha', description: 'Limpeza e alinhamento.', priceCents: 2000, durationMinutes: 15 },
    ];
    for (const service of services) {
      await transaction.service.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: service.name } },
        update: {},
        create: { ...service, tenantId: tenant.id },
      });
    }

    const barbers = [
      { name: 'Lucas Ferreira', specialties: 'Low Fade, Barba' },
      { name: 'Gabriel Santos', specialties: 'Mid Fade, Corte social' },
      { name: 'Rafael Lima', specialties: 'Taper Fade, Corte clássico' },
    ];
    const barberRecords = [];
    for (const barber of barbers) {
      barberRecords.push(await transaction.barber.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: barber.name } },
        update: {},
        create: { tenantId: tenant.id, ...barber, rating: 5, reviewCount: 0 },
      }));
    }

    const styles = [
      ['Low Fade', 'Degradê baixo e discreto.'],
      ['Mid Fade', 'Degradê médio com contraste equilibrado.'],
      ['High Fade', 'Degradê alto e acabamento marcante.'],
      ['Taper Fade', 'Laterais suaves com acabamento natural.'],
      ['Corte social', 'Estilo clássico, alinhado e versátil.'],
      ['Buzz Cut', 'Corte curto e uniforme.'],
      ['Mullet', 'Comprimento e personalidade em destaque.'],
      ['Undercut', 'Contraste definido entre laterais e topo.'],
    ];
    for (const [name, description] of styles) {
      await transaction.hairStyle.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name } },
        update: {},
        create: { tenantId: tenant.id, name, description },
      });
    }

    for (let dayOfWeek = 1; dayOfWeek <= 6; dayOfWeek += 1) {
      await transaction.workingHour.upsert({
        where: { tenantId_dayOfWeek_startMinute: { tenantId: tenant.id, dayOfWeek, startMinute: 540 } },
        update: {},
        create: { tenantId: tenant.id, dayOfWeek, startMinute: 540, endMinute: 1200 },
      });
      for (const barber of barberRecords) {
        await transaction.barberWorkingHour.upsert({
          where: { barberId_dayOfWeek_startMinute: { barberId: barber.id, dayOfWeek, startMinute: 540 } },
          update: {},
          create: { tenantId: tenant.id, barberId: barber.id, dayOfWeek, startMinute: 540, endMinute: dayOfWeek === 6 ? 1080 : 1200 },
        });
      }
    }

    return { tenant, admin };
  });
  console.log(`Administrador ${result.admin.email} criado para ${result.tenant.name}; catálogo inicial e horários adicionados.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());