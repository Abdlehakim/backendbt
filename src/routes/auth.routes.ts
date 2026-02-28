import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@/db";

export const authRouter = Router();

const schema = z.object({
  email: z.string().email().max(190),
  password: z.string().min(8).max(100),
});

const JWT_SECRET = process.env.JWT_ACCESS_SECRET;
if (!JWT_SECRET) throw new Error("JWT_ACCESS_SECRET is missing in .env");

function parseExpiresInToMs(value: string | number): number {
  const fallbackMs = 15 * 60 * 1000;

  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value * 1000 : fallbackMs;
  }

  const raw = String(value || "").trim();
  if (!raw) return fallbackMs;

  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : fallbackMs;
  }

  const match = raw.match(/^(\d+)\s*(ms|s|m|h|d)$/i);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return fallbackMs;

  if (unit === "ms") return amount;
  if (unit === "s") return amount * 1000;
  if (unit === "m") return amount * 60 * 1000;
  if (unit === "h") return amount * 60 * 60 * 1000;
  if (unit === "d") return amount * 24 * 60 * 60 * 1000;
  return fallbackMs;
}

const jwtExpiresRaw = process.env.JWT_ACCESS_EXPIRES ?? "15m";
const JWT_EXPIRES_IN = jwtExpiresRaw as SignOptions["expiresIn"];
const cookieMaxAgeMs = parseExpiresInToMs(jwtExpiresRaw);

// Keep cookie config consistent for set + clear:
const cookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
  sameSite: (process.env.COOKIE_SAMESITE ?? "lax") as "lax" | "strict" | "none",
  path: "/",
  // Keep cookie TTL aligned with JWT expiry.
  maxAge: cookieMaxAgeMs,
};

function setAuthCookie(res: Response, token: string) {
  res.cookie("access_token", token, cookieOptions);
}

function clearAuthCookie(res: Response) {
  res.clearCookie("access_token", cookieOptions);
}

authRouter.post("/signup", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Email already used" });

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      // ✅ enum value must be uppercase (matches SubscriptionStatus enum)
      subscription: { create: { status: "INACTIVE" } },
    },
    select: { id: true, email: true },
  });

  // Use standard "subject" claim for sub:
  const token = jwt.sign({}, JWT_SECRET, { subject: user.id, expiresIn: JWT_EXPIRES_IN });

  setAuthCookie(res, token);
  return res.status(201).json({ user });
});

authRouter.post("/login", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({}, JWT_SECRET, { subject: user.id, expiresIn: JWT_EXPIRES_IN });

  setAuthCookie(res, token);
  return res.json({ ok: true });
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});
