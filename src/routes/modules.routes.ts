import { Router } from "express";
import { prisma } from "@/db";
import { requireAuth } from "@/middleware/auth";
import { requireSubscriptionValid } from "@/middleware/subscription";
import { ModuleKey, SubModuleKey } from "@prisma/client";

export const modulesRouter = Router();

function toArrayOfStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function parseModuleKeys(v: unknown): ModuleKey[] {
  const raw = toArrayOfStrings(v);
  const allowed = new Set(Object.values(ModuleKey));
  const out: ModuleKey[] = [];
  for (const k of raw) {
    if (allowed.has(k as ModuleKey)) out.push(k as ModuleKey);
  }
  return Array.from(new Set(out));
}

function parseSubModuleKeys(v: unknown): SubModuleKey[] {
  const raw = toArrayOfStrings(v);
  const allowed = new Set(Object.values(SubModuleKey));
  const out: SubModuleKey[] = [];
  for (const k of raw) {
    if (allowed.has(k as SubModuleKey)) out.push(k as SubModuleKey);
  }
  return Array.from(new Set(out));
}

modulesRouter.get("/", requireAuth, requireSubscriptionValid, async (_req, res) => {
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
  const moduleKeys = (req as any).auth?.moduleKeys as ModuleKey[] | undefined;
  const subModuleKeys = (req as any).auth?.subModuleKeys as SubModuleKey[] | undefined;

  const mk = Array.isArray(moduleKeys) ? moduleKeys : [];
  const sk = Array.isArray(subModuleKeys) ? subModuleKeys : [];

  const modules = await prisma.module.findMany({
    where: { isActive: true, key: { in: mk } },
    select: {
      key: true,
      name: true,
      subModules: {
        where: { isActive: true, key: { in: sk } },
        select: { key: true, name: true },
        orderBy: { key: "asc" },
      },
    },
    orderBy: { key: "asc" },
  });

  return res.json({ modules });
});

modulesRouter.post("/select", requireAuth, requireSubscriptionValid, async (req, res) => {
  const subscriptionId = (req as any).auth?.subscriptionId as string | undefined;

  if (!subscriptionId) {
    return res.status(403).json({ error: "Subscription required", code: "SUBSCRIPTION_REQUIRED" });
  }

  const moduleKeys = parseModuleKeys(req.body?.moduleKeys);
  const subModuleKeys = parseSubModuleKeys(req.body?.subModuleKeys);

  if (moduleKeys.length === 0) {
    return res.status(400).json({ error: "Modules selection required", code: "MODULES_REQUIRED" });
  }
  if (subModuleKeys.length === 0) {
    return res.status(400).json({ error: "SubModules selection required", code: "SUBMODULES_REQUIRED" });
  }

  const activeModules = await prisma.module.findMany({
    where: { isActive: true, key: { in: moduleKeys } },
    select: { id: true, key: true },
  });

  const activeModuleKeySet = new Set(activeModules.map((m) => m.key));
  const invalidModules = moduleKeys.filter((k) => !activeModuleKeySet.has(k));
  if (invalidModules.length > 0) {
    return res.status(400).json({
      error: `Invalid module keys: ${invalidModules.join(", ")}`,
      code: "INVALID_MODULES",
    });
  }

  const moduleIdByKey = new Map(activeModules.map((m) => [m.key, m.id]));

  const activeSubModules = await prisma.subModule.findMany({
    where: { isActive: true, key: { in: subModuleKeys } },
    select: { id: true, key: true, module: { select: { key: true, isActive: true } } },
  });

  const activeSubKeySet = new Set(activeSubModules.map((s) => s.key));
  const invalidSubModules = subModuleKeys.filter((k) => !activeSubKeySet.has(k));
  if (invalidSubModules.length > 0) {
    return res.status(400).json({
      error: `Invalid submodule keys: ${invalidSubModules.join(", ")}`,
      code: "INVALID_SUBMODULES",
    });
  }

  const badPairs: SubModuleKey[] = [];
  for (const s of activeSubModules) {
    const parentKey = s.module?.key;
    const parentActive = s.module?.isActive !== false;
    if (!parentKey || !parentActive || !activeModuleKeySet.has(parentKey)) {
      badPairs.push(s.key);
    }
  }

  if (badPairs.length > 0) {
    return res.status(400).json({
      error: `SubModules must belong to selected modules: ${badPairs.join(", ")}`,
      code: "SUBMODULE_PARENT_NOT_SELECTED",
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscriptionSubModule.deleteMany({ where: { subscriptionId } });
    await tx.subscriptionModule.deleteMany({ where: { subscriptionId } });

    await tx.subscriptionModule.createMany({
      data: moduleKeys.map((k) => ({
        subscriptionId,
        moduleId: moduleIdByKey.get(k)!,
      })),
      skipDuplicates: true,
    });

    await tx.subscriptionSubModule.createMany({
      data: activeSubModules.map((s) => ({
        subscriptionId,
        subModuleId: s.id,
      })),
      skipDuplicates: true,
    });
  });

  return res.json({ ok: true });
});
