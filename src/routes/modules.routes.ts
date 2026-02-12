import { Router } from "express";
import { prisma } from "@/db";
import { requireAuth } from "@/middleware/auth";
import { requireSubscriptionValid } from "@/middleware/subscription";

export const modulesRouter = Router();

modulesRouter.get("/", async (_req, res) => {
  const modules = await prisma.module.findMany({
    where: { isActive: true },
    select: {
      key: true,
      name: true,
      subModules: {
        where: { isActive: true },
        select: { key: true, name: true },
        orderBy: { key: "asc" },
      },
    },
    orderBy: { key: "asc" },
  });

  return res.json({ modules });
});

modulesRouter.get("/enabled", requireAuth, requireSubscriptionValid, async (req, res) => {
  const moduleKeys =
    (req as any).auth?.moduleKeys ??
    (req as any).moduleKeys ??
    [];

  const subModuleKeys =
    (req as any).auth?.subModuleKeys ??
    (req as any).subModuleKeys ??
    [];

  const modules = await prisma.module.findMany({
    where: {
      isActive: true,
      key: { in: moduleKeys },
    },
    select: {
      key: true,
      name: true,
      subModules: {
        where: {
          isActive: true,
          key: { in: subModuleKeys },
        },
        select: { key: true, name: true },
        orderBy: { key: "asc" },
      },
    },
    orderBy: { key: "asc" },
  });

  return res.json({ modules });
});
