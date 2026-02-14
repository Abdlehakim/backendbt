import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "@/db";
import type { AuthedRequest } from "./types";
import { requireFerraillage } from "./guard";
import { mmSchema } from "./schemas";

export const diametresRouter = Router();

diametresRouter.get("/diametres", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const items = await prisma.ferDiametre.findMany({
    where: { isActive: true },
    orderBy: { mm: "asc" },
    select: { id: true, mm: true, label: true, isActive: true },
  });

  res.json({ items });
});

diametresRouter.post("/diametres", async (req: AuthedRequest, res: Response) => {
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
