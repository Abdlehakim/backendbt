import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/db";

export const onboardingRouter = Router();

const planSchema = z.object({
  plan: z.enum(["INDIVIDUAL", "ENTERPRISE"]),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
});

const modulesSchema = z
  .object({
    moduleKeys: z.array(z.enum(["MODULE_1", "MODULE_2"])).min(1).max(2),
  })
  .or(
    z.object({
      modules: z.array(z.enum(["MODULE_1", "MODULE_2"])).min(1).max(2),
    })
  );

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
      data: {
        status: "ACTIVE",
        plan,
        billingCycle,
        seats,
        currentPeriodEnd,
      },
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
    data: {
      status: "ACTIVE",
      plan,
      billingCycle,
      seats,
      currentPeriodEnd,
    },
  });

  return res.json({ ok: true });
});

onboardingRouter.post("/modules", async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = modulesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const moduleKeys =
    "moduleKeys" in parsed.data ? parsed.data.moduleKeys : parsed.data.modules;

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

  const existing = await prisma.module.findMany({
    where: { key: { in: moduleKeys } },
    select: { id: true, key: true },
  });

  const existingKeys = new Set(existing.map((m) => m.key));
  const missing = moduleKeys.filter((k) => !existingKeys.has(k));

  if (missing.length > 0) {
    await prisma.module.createMany({
      data: missing.map((k) => ({ key: k, name: k })),
      skipDuplicates: true,
    });
  }

  const moduleRows = await prisma.module.findMany({
    where: { key: { in: moduleKeys } },
    select: { id: true, key: true },
  });

  await prisma.subscriptionModule.deleteMany({
    where: { subscriptionId },
  });

  await prisma.subscriptionModule.createMany({
    data: moduleRows.map((m) => ({
      subscriptionId,
      moduleId: m.id,
    })),
    skipDuplicates: true,
  });

  return res.json({ ok: true });
});
