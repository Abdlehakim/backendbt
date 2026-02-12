require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const bcrypt = require("bcryptjs");

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

async function upsertUserWithSubscription(email, plainPassword) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordHash = await bcrypt.hash(String(plainPassword), 12);

  return prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { passwordHash },
    create: {
      email: normalizedEmail,
      passwordHash,
      subscription: { create: { status: "INACTIVE" } },
    },
    select: { id: true, email: true, subscription: { select: { id: true } } },
  });
}

async function ensureCalculateurAndFerraillage() {
  const calculateur = await prisma.module.upsert({
    where: { key: "MODULE_1" },
    update: {
      name: "Calculateur",
      slug: "calculateur",
      route: "/app/calculateur",
      sortOrder: 10,
      isActive: true,
    },
    create: {
      key: "MODULE_1",
      name: "Calculateur",
      slug: "calculateur",
      route: "/app/calculateur",
      sortOrder: 10,
      isActive: true,
    },
    select: { id: true, name: true },
  });

  const ferraillage = await prisma.subModule.upsert({
    where: { key: "FERRAILLAGE" },
    update: {
      name: "Ferraillage",
      slug: "ferraillage",
      route: "/app/calculateur/ferraillage",
      sortOrder: 10,
      isActive: true,
      moduleId: calculateur.id,
    },
    create: {
      key: "FERRAILLAGE",
      name: "Ferraillage",
      slug: "ferraillage",
      route: "/app/calculateur/ferraillage",
      sortOrder: 10,
      isActive: true,
      moduleId: calculateur.id,
    },
    select: { id: true, name: true },
  });

  return { calculateur, ferraillage };
}

async function enableForSubscription(subscriptionId, moduleId, subModuleId) {
  await prisma.subscriptionModule.upsert({
    where: { subscriptionId_moduleId: { subscriptionId, moduleId } },
    update: {},
    create: { subscriptionId, moduleId },
  });

  await prisma.subscriptionSubModule.upsert({
    where: { subscriptionId_subModuleId: { subscriptionId, subModuleId } },
    update: {},
    create: { subscriptionId, subModuleId },
  });
}

async function main() {
  const admin = await upsertUserWithSubscription("admin@smartwebify.com", "Admin123!");
  const ahmed = await upsertUserWithSubscription("ahmed@smartwebify.com", "Ahmed123!");

  const { calculateur, ferraillage } = await ensureCalculateurAndFerraillage();

  await enableForSubscription(admin.subscription.id, calculateur.id, ferraillage.id);
  await enableForSubscription(ahmed.subscription.id, calculateur.id, ferraillage.id);

  console.log("✅ Seed OK:");
  console.log(` - ${admin.email} / Admin123!`);
  console.log(` - ${ahmed.email} / Ahmed123!`);
  console.log(` - Module: ${calculateur.name}`);
  console.log(` - SubModule: ${ferraillage.name}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
