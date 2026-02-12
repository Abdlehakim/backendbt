import type { Request, Response, NextFunction } from "express";
import { prisma } from "@/db";

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
    include: { modules: true },
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

  const moduleKeys = (sub.modules ?? [])
    .map((m: any) => m?.key ?? m?.moduleKey ?? m?.code ?? m?.name ?? m?.id ?? null)
    .filter((x: any): x is string => typeof x === "string" && x.length > 0);

  (req as any).subscription = sub;
  (req as any).moduleKeys = moduleKeys;

  return next();
}

export function requireModulesSelected(req: Request, res: Response, next: NextFunction) {
  const moduleKeys = (req as any).moduleKeys as string[] | undefined;
  if (!moduleKeys || moduleKeys.length === 0) {
    return res.status(403).json({ error: "Modules selection required", code: "MODULES_REQUIRED" });
  }
  return next();
}

export function requireModule(moduleKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const moduleKeys = (req as any).moduleKeys as string[] | undefined;
    if (!moduleKeys || !moduleKeys.includes(moduleKey)) {
      return res.status(403).json({ error: "Module not enabled", code: "MODULE_NOT_ENABLED" });
    }
    return next();
  };
}
