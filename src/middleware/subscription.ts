import type { Request, Response, NextFunction } from "express";
import { prisma } from "@/db";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        subscriptionId: string;
        moduleKeys: string[];
        subModuleKeys: string[];
        subscription: {
          status: string;
          plan: string | null;
          billingCycle: string | null;
          currentPeriodEnd: Date | null;
        };
      };
    }
  }
}

function isExpired(status: unknown, currentPeriodEnd: Date | null) {
  const st = String(status ?? "");
  if (st === "EXPIRED") return true;
  if (!currentPeriodEnd) return true;
  return currentPeriodEnd.getTime() <= Date.now();
}

export async function requireSubscriptionValid(req: Request, res: Response, next: NextFunction) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionId: true },
  });

  const subscriptionId = u?.subscriptionId ?? null;
  if (!subscriptionId) {
    return res.status(403).json({ error: "Subscription required", code: "SUBSCRIPTION_REQUIRED" });
  }

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      status: true,
      plan: true,
      billingCycle: true,
      currentPeriodEnd: true,
      modules: {
        select: {
          module: { select: { key: true, isActive: true } },
        },
      },
      subModules: {
        select: {
          subModule: {
            select: {
              key: true,
              isActive: true,
              module: { select: { key: true, isActive: true } },
            },
          },
        },
      },
    },
  });

  if (!sub) {
    return res.status(403).json({ error: "Subscription required", code: "SUBSCRIPTION_REQUIRED" });
  }

  const planSelected = Boolean(sub.plan);
  const cycleSelected = Boolean(sub.billingCycle);

  if (!planSelected || !cycleSelected) {
    return res.status(403).json({ error: "Plan selection required", code: "PLAN_REQUIRED" });
  }

  const expired = isExpired(sub.status, sub.currentPeriodEnd ?? null);
  const valid = String(sub.status) === "ACTIVE" && !expired;

  if (!valid) {
    return res.status(403).json({ error: "Subscription expired or invalid", code: "SUBSCRIPTION_INVALID" });
  }

  const moduleKeys = Array.from(
    new Set(
      (sub.modules ?? [])
        .filter((m) => m.module?.isActive !== false)
        .map((m) => m.module.key)
    )
  );

  const moduleKeySet = new Set(moduleKeys);

  const subModuleKeys = Array.from(
    new Set(
      (sub.subModules ?? [])
        .filter((s) => s.subModule?.isActive !== false)
        .filter((s) => s.subModule?.module?.isActive !== false)
        .filter((s) => moduleKeySet.has(s.subModule.module.key))
        .map((s) => s.subModule.key)
    )
  );

  req.auth = {
    userId,
    subscriptionId: sub.id,
    moduleKeys,
    subModuleKeys,
    subscription: {
      status: String(sub.status),
      plan: sub.plan ? String(sub.plan) : null,
      billingCycle: sub.billingCycle ? String(sub.billingCycle) : null,
      currentPeriodEnd: sub.currentPeriodEnd ?? null,
    },
  };

  next();
}

export function requireModulesSelected(req: Request, res: Response, next: NextFunction) {
  const keys = req.auth?.moduleKeys ?? [];
  if (keys.length === 0) {
    return res.status(403).json({ error: "Modules selection required", code: "MODULES_REQUIRED" });
  }
  next();
}

export function requireModule(moduleKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const keys = req.auth?.moduleKeys ?? [];
    if (!keys.includes(moduleKey)) {
      return res.status(403).json({ error: "Module not enabled", code: "MODULE_NOT_ENABLED" });
    }
    next();
  };
}

export function requireSubModule(subModuleKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const keys = req.auth?.subModuleKeys ?? [];
    if (!keys.includes(subModuleKey)) {
      return res.status(403).json({ error: "SubModule not enabled", code: "SUBMODULE_NOT_ENABLED" });
    }
    next();
  };
}
