require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

let prisma;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing");
  }

  const adapter = new PrismaMariaDb(databaseUrl);
  prisma = new PrismaClient({ adapter });

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
    select: { id: true },
  });

  await prisma.subModule.upsert({
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
  });

  console.log("Catalog ensured: MODULE_1 / FERRAILLAGE");
}

main()
  .catch((error) => {
    console.error("Catalog ensure failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });
