import { Router } from "express";
import { prisma } from "@/db";
import { requireAuth } from "@/middleware/auth";

export const meRouter = Router();

meRouter.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      subscription: { select: { status: true, plan: true, currentPeriodEnd: true } },
    },
  });

  res.json({
    user,
    subscriptionActive: user?.subscription?.status === "active",
  });
});


