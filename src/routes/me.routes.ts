import { Router } from "express";
import { prisma } from "@/db";
import { requireAuth } from "@/middleware/auth";
import { ModuleKey, SubModuleKey } from "@prisma/client";

export const meRouter = Router();

function computeSubscription(
  sub: { status: string | null; currentPeriodEnd: Date | null } | null
) {
  const now = Date.now();
  const endMs = sub?.currentPeriodEnd ? sub.currentPeriodEnd.getTime() : null;

  const statusUpper = String(sub?.status ?? "").toUpperCase();
  const expiredByDate = endMs !== null && endMs <= now;

  const activeStatus = statusUpper === "ACTIVE";
  const expiredStatus = statusUpper === "EXPIRED";

  const valid = activeStatus && endMs !== null && !expiredByDate;
  const expired = expiredStatus || expiredByDate;

  return {
    valid,
    expired,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
  };
}

meRouter.get("/", requireAuth, async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      subscription: {
        select: {
          status: true,
          plan: true,
          billingCycle: true,
          seats: true,
          currentPeriodEnd: true,
          modules: {
            select: {
              module: { select: { key: true, name: true } },
            },
          },
          subModules: {
            select: {
              subModule: { select: { key: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  const sub = user.subscription ?? null;

  const modules: ModuleKey[] =
    sub?.modules
      ?.map((row) => row.module?.key ?? null)
      .filter((x): x is ModuleKey => x !== null) ?? [];

  const subModules: SubModuleKey[] =
    sub?.subModules
      ?.map((row) => row.subModule?.key ?? null)
      .filter((x): x is SubModuleKey => x !== null) ?? [];

  const planSelected = Boolean(sub?.plan && sub?.billingCycle);
  const modulesSelected = modules.length > 0;

  const subState = computeSubscription(
    sub
      ? {
          status: sub.status ? String(sub.status) : null,
          currentPeriodEnd: sub.currentPeriodEnd ?? null,
        }
      : null
  );

  const onboardingComplete = subState.valid && planSelected && modulesSelected;

  return res.json({
    user: { id: user.id, email: user.email },
    subscriptionActive: subState.valid,
    subscription: sub
      ? {
          status: sub.status ? String(sub.status) : null,
          plan: sub.plan ? String(sub.plan) : null,
          billingCycle: sub.billingCycle ? String(sub.billingCycle) : null,
          seats: typeof sub.seats === "number" ? sub.seats : null,
          currentPeriodEnd: subState.currentPeriodEnd
            ? subState.currentPeriodEnd.toISOString()
            : null,
          expired: subState.expired,
          valid: subState.valid,
        }
      : null,
    plan: sub?.plan ? String(sub.plan) : null,
    modules,
    subModules,
    onboarding: {
      planSelected,
      modulesSelected,
      complete: onboardingComplete,
    },
    onboardingComplete,
  });
});
