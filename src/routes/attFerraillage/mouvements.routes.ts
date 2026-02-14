import { Router, type Response } from "express";
import { prisma } from "@/db";
import type { AuthedRequest } from "./types";
import { requireFerraillage } from "./guard";
import { mouvementCreateSchema, mouvementUpdateSchema } from "./schemas";
import { ensureDiametres } from "./helpers";

export const mouvementsRouter = Router();

mouvementsRouter.post("/etat/:etatId/mouvements", async (req: AuthedRequest, res: Response) => {
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

mouvementsRouter.put("/mouvements/:mouvementId", async (req: AuthedRequest, res: Response) => {
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

mouvementsRouter.delete("/mouvements/:mouvementId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const mouvementId = String(req.params.mouvementId || "").trim();
  if (!mouvementId) return res.status(400).json({ error: "Invalid mouvementId" });

  await prisma.ferMouvement.delete({ where: { id: mouvementId } });
  res.json({ ok: true });
});
