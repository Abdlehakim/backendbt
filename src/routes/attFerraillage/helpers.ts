import { Prisma } from "@prisma/client";

export function normalizeSousTraitant(v?: string | null) {
  const s = (v ?? "").trim();
  return s.length ? s : null;
}

export async function getOrCreateFerRapport(
  tx: Prisma.TransactionClient,
  chantierName: string,
  sousTraitant?: string | null,
) {
  const st = normalizeSousTraitant(sousTraitant);

  const existing = await tx.ferRapport.findFirst({
    where: { chantierName, sousTraitant: st },
    select: { id: true, chantierName: true, sousTraitant: true },
  });

  if (existing) return existing;

  return tx.ferRapport.create({
    data: { chantierName, sousTraitant: st },
    select: { id: true, chantierName: true, sousTraitant: true },
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
