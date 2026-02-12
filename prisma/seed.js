require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const bcrypt = require("bcryptjs");

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminPass = await bcrypt.hash("Admin123!", 10);
  const userPass = await bcrypt.hash("User123!", 10);

  await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: {
      passwordHash: adminPass,
    },
    create: {
      email: "admin@test.com",
      passwordHash: adminPass,
    },
  });

  await prisma.user.upsert({
    where: { email: "user@test.com" },
    update: {
      passwordHash: userPass,
    },
    create: {
      email: "user@test.com",
      passwordHash: userPass,
    },
  });

  console.log("✅ Seed OK:");
  console.log(" - admin@test.com / Admin123!");
  console.log(" - user@test.com  / User123!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
