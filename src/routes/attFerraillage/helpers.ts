import { Prisma } from "@prisma/client";

export function normalizeResponsable(v?: string | null) {
  return (v ?? "").trim();
}

export function pickResponsable(
  responsable?: string | null,
  legacySousTraitant?: string | null,
) {
  const next = normalizeResponsable(responsable);
  if (next) return next;
  return normalizeResponsable(legacySousTraitant);
}

export async function getOrCreateFerRapport(
  tx: Prisma.TransactionClient,
  chantierName: string,
  responsable?: string | null,
) {
  const normalizedResponsable = normalizeResponsable(responsable);

  return tx.ferRapport.upsert({
    where: {
      chantierName_responsable: {
        chantierName,
        responsable: normalizedResponsable,
      },
    },
    update: {},
    create: { chantierName, responsable: normalizedResponsable },
    select: { id: true, chantierName: true, responsable: true },
  });
}

export async function ensureDiametres(tx: Prisma.TransactionClient, mms: number[]) {
  const uniq = Array.from(new Set(mms));
  if (!uniq.length) return;

  const existing = await tx.ferDiametre.findMany({
    where: { mm: { in: uniq } },
    select: { mm: true },
  });

  const have = new Set<number>(existing.map((d: { mm: number }) => d.mm));
  const missing = uniq.filter((mm) => !have.has(mm));

  for (const mm of missing) {
    await tx.ferDiametre.create({ data: { mm, label: `Fer de ${mm}`, isActive: true } });
  }
}
