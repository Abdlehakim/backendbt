import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/db";

export const usersRouter = Router();

function requireCompanyOwner(req: Request, res: Response) {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  if (auth.subscription.plan !== "ENTERPRISE") {
    res.status(403).json({ error: "Company account required", code: "COMPANY_REQUIRED" });
    return null;
  }

  if (auth.role !== "OWNER") {
    res.status(403).json({ error: "Owner permission required", code: "OWNER_REQUIRED" });
    return null;
  }

  return auth;
}

const createUserSchema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  countryCode: z.string().trim().min(1).max(10),
  phone: z.string().trim().min(3).max(40),
  email: z.string().email().max(190),
  password: z.string().min(8).max(100),
});

function normalizeCountryCode(value: string) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? `+${digits}` : "";
}

function normalizePhone(countryCode: string, phone: string) {
  const cc = normalizeCountryCode(countryCode);
  const local = String(phone || "").replace(/[^\d]/g, "");

  if (!cc || !local) return "";

  return `${cc}${local}`;
}

usersRouter.get("/", async (req, res) => {
  const auth = requireCompanyOwner(req, res);
  if (!auth) return;

  const users = await prisma.user.findMany({
    where: { subscriptionId: auth.subscriptionId },
    select: {
      id: true,
      email: true,
      name: true,
      countryCode: true,
      phone: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return res.json({ users });
});

usersRouter.post("/", async (req, res) => {
  const auth = requireCompanyOwner(req, res);
  if (!auth) return;

  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const email = parsed.data.email.trim().toLowerCase();
  const name = parsed.data.name?.trim() || null;
  const countryCode = normalizeCountryCode(parsed.data.countryCode);
  const phone = normalizePhone(countryCode, parsed.data.phone);

  if (!countryCode || !phone) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  const [currentUserCount, subscription, existingUserByEmail, existingUserByPhone] = await Promise.all([
    prisma.user.count({ where: { subscriptionId: auth.subscriptionId } }),
    prisma.subscription.findUnique({
      where: { id: auth.subscriptionId },
      select: { seats: true },
    }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findUnique({ where: { phone }, select: { id: true } }),
  ]);

  if (!subscription) {
    return res.status(403).json({ error: "Subscription required", code: "SUBSCRIPTION_REQUIRED" });
  }

  if (currentUserCount >= subscription.seats) {
    return res.status(403).json({ error: "Seat limit reached", code: "SEAT_LIMIT_REACHED" });
  }

  if (existingUserByEmail) return res.status(409).json({ error: "Email already used" });
  if (existingUserByPhone) return res.status(409).json({ error: "Phone already used" });

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      countryCode,
      phone,
      role: "MEMBER",
      subscriptionId: auth.subscriptionId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      countryCode: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  return res.status(201).json({ user });
});

usersRouter.delete("/:userId", async (req, res) => {
  const auth = requireCompanyOwner(req, res);
  if (!auth) return;

  const userId = String(req.params.userId || "").trim();
  if (!userId) return res.status(400).json({ error: "Invalid userId" });

  if (userId === auth.userId) {
    return res.status(400).json({ error: "Owner cannot delete itself", code: "CANNOT_DELETE_SELF" });
  }

  const deleted = await prisma.user.deleteMany({
    where: { id: userId, subscriptionId: auth.subscriptionId },
  });

  if (deleted.count === 0) {
    return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
  }

  return res.json({ ok: true });
});
