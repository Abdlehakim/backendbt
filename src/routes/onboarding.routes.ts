import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/db";
import { ModuleKey as PrismaModuleKey, SubModuleKey as PrismaSubModuleKey } from "@prisma/client";

export const onboardingRouter = Router();

const planSchema = z.object({
  plan: z.enum(["INDIVIDUAL", "ENTERPRISE"]),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
});

const modulesSchema = z.union([
  z.object({
    moduleKeys: z.array(z.nativeEnum(PrismaModuleKey)).min(1).max(2),
    subModuleKeys: z.array(z.nativeEnum(PrismaSubModuleKey)).optional().default([]),
  }),
  z.object({
    modules: z.array(z.nativeEnum(PrismaModuleKey)).min(1).max(2),
    subModuleKeys: z.array(z.nativeEnum(PrismaSubModuleKey)).optional().default([]),
  }),
]);

type ModuleKey = PrismaModuleKey;
type SubModuleKey = PrismaSubModuleKey;

function addMonth(d: Date) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1);
  return x;
}

function addYear(d: Date) {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + 1);
  return x;
}

onboardingRouter.post("/plan", async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { plan, billingCycle } = parsed.data;

  const seats = plan === "INDIVIDUAL" ? 1 : 5;
  const now = new Date();
  const currentPeriodEnd = billingCycle === "MONTHLY" ? addMonth(now) : addYear(now);

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionId: true },
  });

  const subscriptionId = u?.subscriptionId ?? null;

  if (!subscriptionId) {
    const sub = await prisma.subscription.create({
      data: { status: "ACTIVE", plan, billingCycle, seats, currentPeriodEnd },
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionId: sub.id },
    });

    return res.json({ ok: true });
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: "ACTIVE", plan, billingCycle, seats, currentPeriodEnd },
  });

  return res.json({ ok: true });
});

onboardingRouter.post("/modules", async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = modulesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const moduleKeys: ModuleKey[] =
    "moduleKeys" in parsed.data ? parsed.data.moduleKeys : parsed.data.modules;

  const subModuleKeysInput: SubModuleKey[] = parsed.data.subModuleKeys ?? [];

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionId: true },
  });

  const subscriptionId = u?.subscriptionId ?? null;
  if (!subscriptionId) {
    return res.status(403).json({ error: "Plan selection required", code: "PLAN_REQUIRED" });
  }

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, plan: true, billingCycle: true, status: true },
  });

  if (!sub || !sub.plan || !sub.billingCycle) {
    return res.status(403).json({ error: "Plan selection required", code: "PLAN_REQUIRED" });
  }

  const moduleRows = await prisma.module.findMany({
    where: { key: { in: moduleKeys }, isActive: true },
    select: { id: true, key: true },
  });

  if (moduleRows.length !== moduleKeys.length) {
    const found = new Set(moduleRows.map((m) => m.key));
    const missing = moduleKeys.filter((k) => !found.has(k));
    return res.status(400).json({
      error: "Unknown or inactive module(s)",
      code: "MODULE_NOT_FOUND",
      missing,
    });
  }

  const moduleIdByKey = new Map<ModuleKey, string>(moduleRows.map((m) => [m.key, m.id]));
  const moduleKeyById = new Map<string, ModuleKey>(moduleRows.map((m) => [m.id, m.key]));

  const subRows = await prisma.subModule.findMany({
    where: { isActive: true, moduleId: { in: moduleRows.map((m) => m.id) } },
    select: { id: true, key: true, moduleId: true },
  });

  const allowedSubModuleIdByKey = new Map<SubModuleKey, string>();
  const requiredSubKeysByModule = new Map<ModuleKey, Set<SubModuleKey>>();
  const subModuleParentByKey = new Map<SubModuleKey, ModuleKey>();

  for (const s of subRows) {
    const mk = moduleKeyById.get(s.moduleId);
    if (!mk) continue;

    const sk = s.key as SubModuleKey;

    allowedSubModuleIdByKey.set(sk, s.id);
    subModuleParentByKey.set(sk, mk);

    const set = requiredSubKeysByModule.get(mk) ?? new Set<SubModuleKey>();
    set.add(sk);
    requiredSubKeysByModule.set(mk, set);
  }

  const subModuleKeys = Array.from(new Set(subModuleKeysInput));

  const invalidSubs = subModuleKeys.filter((k) => !allowedSubModuleIdByKey.has(k));
  if (invalidSubs.length) {
    return res.status(400).json({
      error: "Unknown or inactive submodule(s), or submodule not attached to selected module(s)",
      code: "SUBMODULE_NOT_ALLOWED",
      invalid: invalidSubs,
    });
  }

  for (const mk of moduleKeys) {
    const required = requiredSubKeysByModule.get(mk);
    if (!required || required.size === 0) continue;

    const ok = subModuleKeys.some((k) => required.has(k));
    if (!ok) {
      return res.status(400).json({
        error: "SubModule selection required for this module",
        code: "SUBMODULE_REQUIRED",
        moduleKey: mk,
        requiredSubModules: Array.from(required),
      });
    }
  }

  for (const k of subModuleKeys) {
    const parent = subModuleParentByKey.get(k);
    if (parent && !moduleKeys.includes(parent)) {
      return res.status(400).json({
        error: "SubModule requires its parent module",
        code: "MODULE_REQUIRED_FOR_SUBMODULE",
        subModuleKey: k,
        requiredModule: parent,
      });
    }
  }

  const subModuleIds = subModuleKeys
    .map((k) => allowedSubModuleIdByKey.get(k))
    .filter((x): x is string => typeof x === "string" && x.length > 0);

  await prisma.$transaction(async (tx) => {
    await tx.subscriptionModule.deleteMany({ where: { subscriptionId } });
    await tx.subscriptionSubModule.deleteMany({ where: { subscriptionId } });

    await tx.subscriptionModule.createMany({
      data: moduleKeys.map((k) => ({
        subscriptionId,
        moduleId: moduleIdByKey.get(k)!,
      })),
      skipDuplicates: true,
    });

    if (subModuleIds.length) {
      await tx.subscriptionSubModule.createMany({
        data: subModuleIds.map((subModuleId) => ({
          subscriptionId,
          subModuleId,
        })),
        skipDuplicates: true,
      });
    }
  });

  return res.json({ ok: true });
});
