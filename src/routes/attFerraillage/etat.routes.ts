import { Router, type Response } from "express";
import { prisma } from "@/db";
import type { AuthedRequest } from "./types";
import { requireFerraillage } from "./guard";
import { etatCreateSchema } from "./schemas";
import { getOrCreateFerRapport } from "./helpers";

export const etatRouter = Router();

etatRouter.post("/etat", async (req: AuthedRequest, res: Response) => {
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
        data: { rapportId, etatDate: parsed.data.etatDate ?? null },
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

etatRouter.get("/etat/by-rapport/:rapportId", async (req: AuthedRequest, res: Response) => {
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

etatRouter.get("/etat/:etatId", async (req: AuthedRequest, res: Response) => {
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
