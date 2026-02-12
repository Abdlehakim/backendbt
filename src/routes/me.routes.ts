import { Router } from "express";
import { prisma } from "@/db";
import { requireAuth } from "@/middleware/auth";

export const meRouter = Router();

meRouter.get("/", requireAuth, async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      subscription: {
        select: { status: true, plan: true, currentPeriodEnd: true },
      },
    },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  return res.json({
    user,
    subscriptionActive: user.subscription?.status === "active",
  });
});
