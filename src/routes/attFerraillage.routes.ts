import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "@/db";
import { Prisma, SubModuleKey as PrismaSubModuleKey, FerMouvementType } from "@prisma/client";

export const attFerraillageRouter = Router();

type AuthedRequest = Request & { userId?: string };

async function requireFerraillage(req: AuthedRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionId: true },
  });

  const subscriptionId = u?.subscriptionId ?? null;
  if (!subscriptionId) {
    res.status(403).json({ error: "Plan selection required", code: "PLAN_REQUIRED" });
    return null;
  }

  const sub = await prisma.subModule.findUnique({
    where: { key: PrismaSubModuleKey.FERRAILLAGE },
    select: { id: true, isActive: true },
  });

  if (!sub || !sub.isActive) {
    res.status(403).json({ error: "Ferraillage not available", code: "SUBMODULE_INACTIVE" });
    return null;
  }

  const enabled = await prisma.subscriptionSubModule.findUnique({
    where: { subscriptionId_subModuleId: { subscriptionId, subModuleId: sub.id } },
    select: { subscriptionId: true },
  });

  if (!enabled) {
    res.status(403).json({ error: "Ferraillage not enabled", code: "SUBMODULE_NOT_ENABLED" });
    return null;
  }

  return { userId, subscriptionId, subModuleId: sub.id };
}

function normalizeSousTraitant(v?: string | null) {
  const s = (v ?? "").trim();
  return s.length ? s : null;
}

async function getOrCreateFerRapport(
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

const mmSchema = z.number().int().min(1).max(100);
const qtySchema = z.union([z.string(), z.number()]).transform((v) => new Prisma.Decimal(String(v)));
const lignesSchema = z.array(z.object({ mm: mmSchema, qty: qtySchema })).min(1);
const mouvementTypeSchema = z.nativeEnum(FerMouvementType).default(FerMouvementType.LIVRAISON);

const etatCreateSchema = z
  .object({
    rapportId: z.string().cuid().optional(),
    chantierName: z.string().min(1).optional(),
    sousTraitant: z.string().optional().nullable(),
    etatDate: z.coerce.date().optional().nullable(),
  })
  .refine((d) => Boolean(d.rapportId || d.chantierName), {
    message: "rapportId or chantierName is required",
  });

const mouvementCreateSchema = z.object({
  date: z.coerce.date(),
  type: mouvementTypeSchema,
  bonLivraison: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  lignes: lignesSchema,
});

const mouvementUpdateSchema = z.object({
  date: z.coerce.date().optional(),
  type: z.nativeEnum(FerMouvementType).optional(),
  bonLivraison: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  lignes: lignesSchema.optional(),
});

const restantCreateSchema = z
  .object({
    rapportId: z.string().cuid().optional(),
    chantierName: z.string().min(1).optional(),
    sousTraitant: z.string().optional().nullable(),
    rapportDate: z.coerce.date().optional().nullable(),
  })
  .refine((d) => Boolean(d.rapportId || d.chantierName), {
    message: "rapportId or chantierName is required",
  });

const restantSnapshotSchema = z.object({
  date: z.coerce.date(),
  note: z.string().optional().nullable(),
  lignes: lignesSchema,
});

async function ensureDiametres(tx: Prisma.TransactionClient, mms: number[]) {
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

attFerraillageRouter.get("/diametres", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const items = await prisma.ferDiametre.findMany({
    where: { isActive: true },
    orderBy: { mm: "asc" },
    select: { id: true, mm: true, label: true, isActive: true },
  });

  res.json({ items });
});

attFerraillageRouter.post("/diametres", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const parsed = z
    .object({
      mm: mmSchema,
      label: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { mm, label, isActive } = parsed.data;

  const item = await prisma.ferDiametre.upsert({
    where: { mm },
    update: { label: label ?? undefined, isActive: isActive ?? true },
    create: { mm, label: label ?? `Fer de ${mm}`, isActive: isActive ?? true },
    select: { id: true, mm: true, label: true, isActive: true },
  });

  res.json({ item });
});

attFerraillageRouter.post("/etat", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const parsed = etatCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const item = await prisma
    .$transaction(async (tx) => {
      let rapportId = parsed.data.rapportId;

      if (!rapportId) {
        const rapport = await getOrCreateFerRapport(
          tx,
          parsed.data.chantierName!,
          parsed.data.sousTraitant ?? null,
        );
        rapportId = rapport.id;
      } else {
        const exists = await tx.ferRapport.findUnique({ where: { id: rapportId }, select: { id: true } });
        if (!exists) throw new Error("RAPPORT_NOT_FOUND");
      }

      return tx.ferEtatChantier.create({
        data: {
          rapportId,
          etatDate: parsed.data.etatDate ?? null,
        },
        include: { rapport: true },
      });
    })
    .catch((e: unknown) => {
      if (e instanceof Error && e.message === "RAPPORT_NOT_FOUND") return null;
      throw e;
    });

  if (!item) return res.status(404).json({ error: "Rapport not found" });
  res.json({ item });
});

attFerraillageRouter.get("/etat/by-rapport/:rapportId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const rapportId = String(req.params.rapportId || "").trim();
  if (!rapportId) return res.status(400).json({ error: "Invalid rapportId" });

  const item = await prisma.ferEtatChantier.findFirst({
    where: { rapportId },
    orderBy: [{ etatDate: "desc" }, { createdAt: "desc" }],
    include: {
      rapport: true,
      mouvements: {
        orderBy: { date: "asc" },
        include: { lignes: { include: { diametre: true } } },
      },
    },
  });

  res.json({ item });
});

attFerraillageRouter.get("/etat/:etatId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const etatId = String(req.params.etatId || "").trim();
  if (!etatId) return res.status(400).json({ error: "Invalid etatId" });

  const item = await prisma.ferEtatChantier.findUnique({
    where: { id: etatId },
    include: {
      rapport: true,
      mouvements: {
        orderBy: { date: "asc" },
        include: { lignes: { include: { diametre: true } } },
      },
    },
  });

  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ item });
});

attFerraillageRouter.post("/etat/:etatId/mouvements", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const etatId = String(req.params.etatId || "").trim();
  if (!etatId) return res.status(400).json({ error: "Invalid etatId" });

  const parsed = mouvementCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { date, type, bonLivraison, note, lignes } = parsed.data;

  const item = await prisma.$transaction(async (tx) => {
    await ensureDiametres(tx, lignes.map((l) => l.mm));

    return tx.ferMouvement.create({
      data: {
        etatId,
        date,
        type,
        bonLivraison: bonLivraison ?? null,
        note: note ?? null,
        lignes: {
          create: lignes.map((l) => ({
            diametre: { connect: { mm: l.mm } },
            qty: l.qty,
          })),
        },
      },
      include: { lignes: { include: { diametre: true } } },
    });
  });

  res.json({ item });
});

attFerraillageRouter.put("/mouvements/:mouvementId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const mouvementId = String(req.params.mouvementId || "").trim();
  if (!mouvementId) return res.status(400).json({ error: "Invalid mouvementId" });

  const parsed = mouvementUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { date, type, bonLivraison, note, lignes } = parsed.data;

  const item = await prisma.$transaction(async (tx) => {
    if (lignes) {
      await ensureDiametres(tx, lignes.map((l) => l.mm));

      const diams = await tx.ferDiametre.findMany({
        where: { mm: { in: Array.from(new Set(lignes.map((l) => l.mm))) } },
        select: { id: true, mm: true },
      });

      const idByMm = new Map<number, string>(diams.map((d: { id: string; mm: number }) => [d.mm, d.id]));

      await tx.ferMouvementLigne.deleteMany({ where: { mouvementId } });
      await tx.ferMouvementLigne.createMany({
        data: lignes.map((l) => ({
          mouvementId,
          diametreId: idByMm.get(l.mm)!,
          qty: l.qty,
        })),
      });
    }

    return tx.ferMouvement.update({
      where: { id: mouvementId },
      data: {
        date: date ?? undefined,
        type: type ?? undefined,
        bonLivraison: bonLivraison === undefined ? undefined : bonLivraison,
        note: note === undefined ? undefined : note,
      },
      include: { lignes: { include: { diametre: true } } },
    });
  });

  res.json({ item });
});

attFerraillageRouter.delete("/mouvements/:mouvementId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const mouvementId = String(req.params.mouvementId || "").trim();
  if (!mouvementId) return res.status(400).json({ error: "Invalid mouvementId" });

  await prisma.ferMouvement.delete({ where: { id: mouvementId } });
  res.json({ ok: true });
});

attFerraillageRouter.post("/restant", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const parsed = restantCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const item = await prisma
    .$transaction(async (tx) => {
      let rapportId = parsed.data.rapportId;

      if (!rapportId) {
        const rapport = await getOrCreateFerRapport(
          tx,
          parsed.data.chantierName!,
          parsed.data.sousTraitant ?? null,
        );
        rapportId = rapport.id;
      } else {
        const exists = await tx.ferRapport.findUnique({ where: { id: rapportId }, select: { id: true } });
        if (!exists) throw new Error("RAPPORT_NOT_FOUND");
      }

      return tx.ferRestantNonConfectionne.create({
        data: {
          rapportId,
          rapportDate: parsed.data.rapportDate ?? null,
        },
        include: { rapport: true },
      });
    })
    .catch((e: unknown) => {
      if (e instanceof Error && e.message === "RAPPORT_NOT_FOUND") return null;
      throw e;
    });

  if (!item) return res.status(404).json({ error: "Rapport not found" });
  res.json({ item });
});

attFerraillageRouter.get("/restant/by-rapport/:rapportId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const rapportId = String(req.params.rapportId || "").trim();
  if (!rapportId) return res.status(400).json({ error: "Invalid rapportId" });

  const item = await prisma.ferRestantNonConfectionne.findFirst({
    where: { rapportId },
    orderBy: [{ rapportDate: "desc" }, { createdAt: "desc" }],
    include: {
      rapport: true,
      snapshots: {
        orderBy: { date: "asc" },
        include: { lignes: { include: { diametre: true } } },
      },
    },
  });

  res.json({ item });
});

attFerraillageRouter.get("/restant/:restantId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const restantId = String(req.params.restantId || "").trim();
  if (!restantId) return res.status(400).json({ error: "Invalid restantId" });

  const item = await prisma.ferRestantNonConfectionne.findUnique({
    where: { id: restantId },
    include: {
      rapport: true,
      snapshots: {
        orderBy: { date: "asc" },
        include: { lignes: { include: { diametre: true } } },
      },
    },
  });

  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ item });
});

attFerraillageRouter.put("/restant/:restantId/snapshot", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const restantId = String(req.params.restantId || "").trim();
  if (!restantId) return res.status(400).json({ error: "Invalid restantId" });

  const parsed = restantSnapshotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { date, note, lignes } = parsed.data;

  const item = await prisma.$transaction(async (tx) => {
    await ensureDiametres(tx, lignes.map((l) => l.mm));

    const existing = await tx.ferRestantSnapshot.findFirst({
      where: { rapportId: restantId, date },
      select: { id: true },
    });

    const snapId =
      existing?.id ??
      (
        await tx.ferRestantSnapshot.create({
          data: { rapportId: restantId, date, note: note ?? null },
          select: { id: true },
        })
      ).id;

    if (existing?.id) {
      await tx.ferRestantSnapshot.update({
        where: { id: snapId },
        data: { note: note ?? null },
      });
    }

    const diams = await tx.ferDiametre.findMany({
      where: { mm: { in: Array.from(new Set(lignes.map((l) => l.mm))) } },
      select: { id: true, mm: true },
    });

    const idByMm = new Map<number, string>(diams.map((d: { id: string; mm: number }) => [d.mm, d.id]));

    await tx.ferRestantLigne.deleteMany({ where: { snapshotId: snapId } });
    await tx.ferRestantLigne.createMany({
      data: lignes.map((l) => ({
        snapshotId: snapId,
        diametreId: idByMm.get(l.mm)!,
        qty: l.qty,
      })),
    });

    return tx.ferRestantSnapshot.findUnique({
      where: { id: snapId },
      include: { lignes: { include: { diametre: true } } },
    });
  });

  res.json({ item });
});

attFerraillageRouter.delete("/restant/:restantId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const restantId = String(req.params.restantId || "").trim();
  if (!restantId) return res.status(400).json({ error: "Invalid restantId" });

  await prisma.ferRestantNonConfectionne.delete({ where: { id: restantId } });
  res.json({ ok: true });
});
