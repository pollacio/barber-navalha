import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'navalha-studio' },
    update: {},
    create: { slug: 'navalha-studio', name: 'Navalha Studio', timezone: 'America/Sao_Paulo' },
  });

  const passwordHash = await bcrypt.hash('Navalha123!', 12);
  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@navalha.test' } },
    update: {},
    create: { tenantId: tenant.id, email: 'admin@navalha.test', name: 'Rafael Mendes', role: 'ADMIN', passwordHash },
  });
  void admin;

  const barberSeeds = [
    { name: 'Lucas Ferreira', email: 'lucas@navalha.test', specialties: 'Low Fade, Barba' },
    { name: 'Gabriel Santos', email: 'gabriel@navalha.test', specialties: 'Mid Fade, Corte social' },
    { name: 'Rafael Lima', email: 'rafael@navalha.test', specialties: 'Taper Fade, Corte clássico' },
  ];
  const barbers = [];

  for (const item of barberSeeds) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: item.email } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: item.email,
        name: item.name,
        role: 'BARBER',
        passwordHash,
        barberProfile: {
          create: {
            tenantId: tenant.id,
            name: item.name,
            specialties: item.specialties,
            rating: 4.9,
            reviewCount: 38,
          },
        },
      },
      include: { barberProfile: true },
    });
    barbers.push(user.barberProfile || await prisma.barber.findFirst({ where: { tenantId: tenant.id, userId: user.id } }));
  }

  const customerUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'cliente@navalha.test' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'cliente@navalha.test',
      name: 'Thiago Almeida',
      phone: '11999990000',
      role: 'CUSTOMER',
      passwordHash,
      customerProfile: { create: { tenantId: tenant.id } },
    },
  });
  void customerUser;

  const serviceSeeds = [
    { name: 'Corte degradê', description: 'Degradê personalizado com acabamento na navalha.', priceCents: 6500, durationMinutes: 45 },
    { name: 'Corte clássico', description: 'Corte clássico com finalização profissional.', priceCents: 5500, durationMinutes: 40 },
    { name: 'Barba completa', description: 'Modelagem, toalha quente e acabamento.', priceCents: 4500, durationMinutes: 30 },
    { name: 'Corte + barba', description: 'Corte completo com barba e toalha quente.', priceCents: 9500, durationMinutes: 75 },
    { name: 'Corte infantil', description: 'Corte para crianças com atenção especial.', priceCents: 5000, durationMinutes: 40 },
    { name: 'Sobrancelha', description: 'Limpeza e alinhamento.', priceCents: 2000, durationMinutes: 15 },
  ];

  for (const service of serviceSeeds) {
    await prisma.service.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: service.name } },
      update: service,
      create: { ...service, tenantId: tenant.id },
    });
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
    await prisma.hairStyle.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: { description },
      create: { tenantId: tenant.id, name, description },
    });
  }

  for (let dayOfWeek = 1; dayOfWeek <= 6; dayOfWeek += 1) {
    await prisma.workingHour.upsert({
      where: { tenantId_dayOfWeek_startMinute: { tenantId: tenant.id, dayOfWeek, startMinute: 540 } },
      update: { endMinute: 1200, isOpen: true },
      create: { tenantId: tenant.id, dayOfWeek, startMinute: 540, endMinute: 1200 },
    });

    for (const barber of barbers) {
      await prisma.barberWorkingHour.upsert({
        where: { barberId_dayOfWeek_startMinute: { barberId: barber.id, dayOfWeek, startMinute: 540 } },
        update: { endMinute: dayOfWeek === 6 ? 1080 : 1200, isAvailable: true },
        create: { tenantId: tenant.id, barberId: barber.id, dayOfWeek, startMinute: 540, endMinute: dayOfWeek === 6 ? 1080 : 1200 },
      });
    }
  }

  console.log(`Seed concluído para ${tenant.name}. Contas de demonstração: admin@navalha.test, lucas@navalha.test e cliente@navalha.test.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());