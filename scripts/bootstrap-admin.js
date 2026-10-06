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
  const tenant = existingTenant
    ? existingTenant
    : await prisma.tenant.create({ data: { slug: tenantSlug, name: tenantName } });
  const admin = await prisma.user.create({
    data: { tenantId: tenant.id, name: adminName, email: adminEmail, passwordHash, role: 'ADMIN' },
    select: { name: true, email: true },
  });
  console.log(`Administrador ${admin.email} criado para ${tenant.name}.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());