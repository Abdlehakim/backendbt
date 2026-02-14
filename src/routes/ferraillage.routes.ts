import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "@/db";
import { SubModuleKey as PrismaSubModuleKey } from "@prisma/client";
import { attFerraillageRouter } from "./attFerraillage.routes";

export const ferraillageRouter = Router();

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

const rapportCreateSchema = z.object({
  chantierName: z.string().min(1),
  sousTraitant: z.string().optional().nullable(),
});

ferraillageRouter.get("/rapports", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const q = String(req.query.q ?? "").trim();

  const items = await prisma.ferRapport.findMany({
    where: q ? { chantierName: { contains: q } } : undefined,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      chantierName: true,
      sousTraitant: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { etats: true, restants: true } },
    },
  });

  res.json({ items });
});

ferraillageRouter.post("/rapports", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const parsed = rapportCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const chantierName = parsed.data.chantierName.trim();
  const sousTraitant = normalizeSousTraitant(parsed.data.sousTraitant);

  // NOTE: No unique constraint in schema → duplicates are possible.
  // If you later add @@unique([chantierName, sousTraitant]), switch this to upsert.
  const item = await prisma.ferRapport.create({
    data: { chantierName, sousTraitant },
    select: {
      id: true,
      chantierName: true,
      sousTraitant: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ item });
});

ferraillageRouter.get("/rapports/:rapportId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const rapportId = String(req.params.rapportId || "").trim();
  if (!rapportId) return res.status(400).json({ error: "Invalid rapportId" });

  const item = await prisma.ferRapport.findUnique({
    where: { id: rapportId },
    include: {
      etats: { orderBy: { createdAt: "desc" } },
      restants: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ item });
});

ferraillageRouter.delete("/rapports/:rapportId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const rapportId = String(req.params.rapportId || "").trim();
  if (!rapportId) return res.status(400).json({ error: "Invalid rapportId" });

  await prisma.ferRapport.delete({ where: { id: rapportId } }); // cascades to etats/restants if your schema uses onDelete: Cascade
  res.json({ ok: true });
});

ferraillageRouter.use(attFerraillageRouter);
