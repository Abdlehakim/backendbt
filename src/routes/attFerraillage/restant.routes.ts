import { Router, type Response } from "express";
import { prisma } from "@/db";
import type { AuthedRequest } from "./types";
import { requireFerraillage } from "./guard";
import { restantCreateSchema, restantSnapshotSchema } from "./schemas";
import { ensureDiametres, getOrCreateFerRapport } from "./helpers";

export const restantRouter = Router();

restantRouter.post("/restant", async (req: AuthedRequest, res: Response) => {
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
        data: { rapportId, rapportDate: parsed.data.rapportDate ?? null },
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

restantRouter.get("/restant/by-rapport/:rapportId", async (req: AuthedRequest, res: Response) => {
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

restantRouter.get("/restant/:restantId", async (req: AuthedRequest, res: Response) => {
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

restantRouter.put("/restant/:restantId/snapshot", async (req: AuthedRequest, res: Response) => {
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

restantRouter.delete("/restant/:restantId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const restantId = String(req.params.restantId || "").trim();
  if (!restantId) return res.status(400).json({ error: "Invalid restantId" });

  await prisma.ferRestantNonConfectionne.delete({ where: { id: restantId } });
  res.json({ ok: true });
});
