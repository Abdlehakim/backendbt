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
    update: {
      passwordHash,
    },
    create: {
      email: normalizedEmail,
      passwordHash,
      subscription: {
        create: {
          status: "INACTIVE",
        },
      },
    },
    // ✅ on récupère aussi subscription.id pour pouvoir lier modules/subModules
    select: { id: true, email: true, subscription: { select: { id: true } } },
  });
}

async function ensureCalculateurAndFerraillage() {
  // MODULE_1 => "Calculateur"
  const calculateur = await prisma.module.upsert({
    where: { key: "MODULE_1" },
    update: { name: "Calculateur", isActive: true },
    create: { key: "MODULE_1", name: "Calculateur", isActive: true },
    select: { id: true, name: true },
  });

  // SubModule => "Ferraillage" lié au module Calculateur
  const ferraillage = await prisma.subModule.upsert({
    where: { key: "FERRAILLAGE" },
    update: { name: "Ferraillage", isActive: true, moduleId: calculateur.id },
    create: {
      key: "FERRAILLAGE",
      name: "Ferraillage",
      isActive: true,
      moduleId: calculateur.id,
    },
    select: { id: true, name: true },
  });

  return { calculateur, ferraillage };
}

async function enableForSubscription(subscriptionId, moduleId, subModuleId) {
  // Lien Subscription <-> Module
  await prisma.subscriptionModule.upsert({
    where: {
      subscriptionId_moduleId: { subscriptionId, moduleId },
    },
    update: {},
    create: { subscriptionId, moduleId },
  });

  // Lien Subscription <-> SubModule
  await prisma.subscriptionSubModule.upsert({
    where: {
      subscriptionId_subModuleId: { subscriptionId, subModuleId },
    },
    update: {},
    create: { subscriptionId, subModuleId },
  });
}

async function main() {
  const admin = await upsertUserWithSubscription("admin@smartwebify.com", "Admin123!");
  const ahmed = await upsertUserWithSubscription("ahmed@smartwebify.com", "Ahmed123!");

  const { calculateur, ferraillage } = await ensureCalculateurAndFerraillage();

  // ✅ Activer pour les 2 subscriptions (si tu ne veux pas activer, supprime ces 2 lignes)
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
