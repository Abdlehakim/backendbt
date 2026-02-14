import type { Response } from "express";
import { prisma } from "@/db";
import { SubModuleKey as PrismaSubModuleKey } from "@prisma/client";
import type { AuthedRequest } from "./types";

export async function requireFerraillage(req: AuthedRequest, res: Response) {
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
