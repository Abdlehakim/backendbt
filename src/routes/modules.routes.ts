import { Router } from "express";
import { prisma } from "@/db";

export const modulesRouter = Router();

modulesRouter.get("/", async (_req, res) => {
  const modules = await prisma.module.findMany({
    select: { key: true, name: true },
    orderBy: { key: "asc" },
  });

  return res.json({ modules });
});
