require("dotenv/config");
const { PrismaClient, Prisma } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

function dmyToDate(dmy) {
  const [dd, mm, yyyy] = String(dmy).split("/");
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
}

function normSousTraitant(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

async function ensureFerDiametres(mmList) {
  for (const mm of mmList) {
    await prisma.ferDiametre.upsert({
      where: { mm },
      update: { isActive: true },
      create: { mm, label: `Fer de ${mm}`, isActive: true },
    });
  }
}

async function getOrCreateFerRapport({ chantierName, sousTraitant }) {
  const st = normSousTraitant(sousTraitant);

  const existing = await prisma.ferRapport.findFirst({
    where: { chantierName, sousTraitant: st },
    select: { id: true, chantierName: true, sousTraitant: true },
  });

  if (existing) return existing;

  return prisma.ferRapport.create({
    data: { chantierName, sousTraitant: st },
    select: { id: true, chantierName: true, sousTraitant: true },
  });
}

async function seedEtatFerLivre({ rapportId, etatDate }) {
  // remove previous doc for same rapport + same date (safe re-seed)
  await prisma.ferEtatChantier.deleteMany({
    where: { rapportId, etatDate },
  });

  return prisma.ferEtatChantier.create({
    data: {
      rapport: { connect: { id: rapportId } },
      etatDate,
      mouvements: {
        create: [
          {
            date: dmyToDate("14/08/2024"),
            // type defaults to LIVRAISON
            bonLivraison: "2416285",
            lignes: {
              create: [
                { diametre: { connect: { mm: 6 } }, qty: new Prisma.Decimal("2.063") },
                { diametre: { connect: { mm: 8 } }, qty: new Prisma.Decimal("2.056") },
                { diametre: { connect: { mm: 10 } }, qty: new Prisma.Decimal("8.633") },
                { diametre: { connect: { mm: 12 } }, qty: new Prisma.Decimal("8.668") },
                { diametre: { connect: { mm: 14 } }, qty: new Prisma.Decimal("4.503") },
              ],
            },
          },
          {
            date: dmyToDate("15/08/2024"),
            bonLivraison: "2416892",
            lignes: {
              create: [
                { diametre: { connect: { mm: 6 } }, qty: new Prisma.Decimal("2.084") },
                { diametre: { connect: { mm: 12 } }, qty: new Prisma.Decimal("2.160") },
                { diametre: { connect: { mm: 14 } }, qty: new Prisma.Decimal("4.376") },
                { diametre: { connect: { mm: 16 } }, qty: new Prisma.Decimal("10.822") },
                { diametre: { connect: { mm: 20 } }, qty: new Prisma.Decimal("6.395") },
              ],
            },
          },
          {
            date: dmyToDate("04/11/2024"),
            type: "TRANSFERT",
            note: "Qté. Fer Transférée à Monja ZEDINI Chantier KROSCHU",
            lignes: {
              create: [{ diametre: { connect: { mm: 20 } }, qty: new Prisma.Decimal("-3.500") }],
            },
          },
        ],
      },
    },
    select: {
      id: true,
      etatDate: true,
      rapport: { select: { chantierName: true, sousTraitant: true } },
    },
  });
}

async function seedRestantNonConfectionne({ rapportId, rapportDate }) {
  // remove previous doc for same rapport + same date (safe re-seed)
  await prisma.ferRestantNonConfectionne.deleteMany({
    where: { rapportId, rapportDate },
  });

  return prisma.ferRestantNonConfectionne.create({
    data: {
      rapport: { connect: { id: rapportId } },
      rapportDate,
      snapshots: {
        create: [
          {
            date: dmyToDate("12/09/2025"),
            lignes: {
              create: [
                { diametre: { connect: { mm: 6 } }, qty: new Prisma.Decimal("0.500") },
                { diametre: { connect: { mm: 8 } }, qty: new Prisma.Decimal("2.000") },
                { diametre: { connect: { mm: 10 } }, qty: new Prisma.Decimal("2.125") },
                { diametre: { connect: { mm: 12 } }, qty: new Prisma.Decimal("1.300") },
                { diametre: { connect: { mm: 14 } }, qty: new Prisma.Decimal("4.400") },
                { diametre: { connect: { mm: 16 } }, qty: new Prisma.Decimal("1.500") },
                { diametre: { connect: { mm: 20 } }, qty: new Prisma.Decimal("4.000") },
              ],
            },
          },
          {
            date: dmyToDate("25/09/2025"),
            lignes: {
              create: [
                { diametre: { connect: { mm: 6 } }, qty: new Prisma.Decimal("3.000") },
                { diametre: { connect: { mm: 8 } }, qty: new Prisma.Decimal("1.500") },
                { diametre: { connect: { mm: 10 } }, qty: new Prisma.Decimal("7.500") },
                { diametre: { connect: { mm: 12 } }, qty: new Prisma.Decimal("4.000") },
                { diametre: { connect: { mm: 14 } }, qty: new Prisma.Decimal("1.000") },
                { diametre: { connect: { mm: 16 } }, qty: new Prisma.Decimal("2.277") },
                { diametre: { connect: { mm: 20 } }, qty: new Prisma.Decimal("4.000") },
              ],
            },
          },
        ],
      },
    },
    select: {
      id: true,
      rapportDate: true,
      rapport: { select: { chantierName: true, sousTraitant: true } },
    },
  });
}

async function runFerraillageSeed() {
  const chantierName = "Pharmaghreb - El Agba";
  const sousTraitant = "Ste. AM SIOUD CONSTRUCTION";

  await ensureFerDiametres([5, 6, 8, 10, 12, 14, 16, 20, 21]);

  const rapport = await getOrCreateFerRapport({ chantierName, sousTraitant });

  const etat = await seedEtatFerLivre({
    rapportId: rapport.id,
    etatDate: dmyToDate("25/11/2025"),
  });

  const restant = await seedRestantNonConfectionne({
    rapportId: rapport.id,
    rapportDate: dmyToDate("25/11/2025"),
  });

  console.log("✅ Ferraillage seed OK:");
  console.log(` - Rapport: ${rapport.chantierName} (${rapport.id})`);
  console.log(` - Etat Fer Livre: ${etat.id} (etatDate=${etat.etatDate?.toISOString?.() ?? etat.etatDate})`);
  console.log(` - Restant Non Confectionné: ${restant.id} (rapportDate=${restant.rapportDate?.toISOString?.() ?? restant.rapportDate})`);
}

module.exports = { runFerraillageSeed };

if (require.main === module) {
  runFerraillageSeed()
    .catch((e) => {
      console.error("❌ Ferraillage seed error:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
