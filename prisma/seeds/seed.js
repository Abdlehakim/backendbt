require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const bcrypt = require("bcryptjs");

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

function normalizeCountryCode(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? `+${digits}` : "";
}

function normalizePhone(countryCode, phone) {
  const cc = normalizeCountryCode(countryCode);
  const local = String(phone || "").replace(/[^\d]/g, "");

  if (!cc || !local) return "";

  return `${cc}${local}`;
}

function activeEnterpriseSubscriptionData(accountName) {
  return {
    status: "ACTIVE",
    plan: "ENTERPRISE",
    billingCycle: "MONTHLY",
    seats: 5,
    accountName,
    currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  };
}

async function upsertUserWithSubscription({
  email,
  plainPassword,
  name,
  countryCode,
  phone,
  accountName,
}) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const normalizedPhone = normalizePhone(normalizedCountryCode, phone);
  const passwordHash = await bcrypt.hash(String(plainPassword), 12);

  if (!normalizedCountryCode || !normalizedPhone) {
    throw new Error(`Invalid phone for seed user ${normalizedEmail}`);
  }

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      email: normalizedEmail,
      passwordHash,
      name,
      countryCode: normalizedCountryCode,
      phone: normalizedPhone,
      role: "OWNER",
    },
    create: {
      email: normalizedEmail,
      passwordHash,
      name,
      countryCode: normalizedCountryCode,
      phone: normalizedPhone,
      role: "OWNER",
      subscription: {
        create: activeEnterpriseSubscriptionData(accountName),
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      countryCode: true,
      phone: true,
      subscriptionId: true,
      subscription: { select: { id: true } },
    },
  });

  let subscriptionId = user.subscription?.id || user.subscriptionId;

  if (!subscriptionId) {
    const subscription = await prisma.subscription.create({
      data: activeEnterpriseSubscriptionData(accountName),
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { subscriptionId: subscription.id },
    });

    subscriptionId = subscription.id;
  } else {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: activeEnterpriseSubscriptionData(accountName),
    });
  }

  return {
    ...user,
    subscription: { id: subscriptionId },
  };
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
  const admin = await upsertUserWithSubscription({
    email: "admin@smartwebify.com",
    plainPassword: "Admin123!",
    name: "Admin SmartWebify",
    countryCode: "+216",
    phone: "98257594",
    accountName: "SmartWebify Admin",
  });

  const ahmed = await upsertUserWithSubscription({
    email: "ahmed@smartwebify.com",
    plainPassword: "Ahmed123!",
    name: "Ahmed SmartWebify",
    countryCode: "+216",
    phone: "92263400",
    accountName: "SmartWebify Ahmed",
  });

  const { calculateur, ferraillage } = await ensureCalculateurAndFerraillage();

  await enableForSubscription(admin.subscription.id, calculateur.id, ferraillage.id);
  await enableForSubscription(ahmed.subscription.id, calculateur.id, ferraillage.id);

  console.log("✅ Seed OK:");
  console.log(` - ${admin.email} / +216 98257594 / Admin123!`);
  console.log(` - ${ahmed.email} / +216 92263400 / Ahmed123!`);
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