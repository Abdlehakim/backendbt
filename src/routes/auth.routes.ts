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

const JWT_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES ?? "15m") as SignOptions["expiresIn"];

// Keep cookie config consistent for set + clear:
const cookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
  sameSite: (process.env.COOKIE_SAMESITE ?? "lax") as "lax" | "strict" | "none",
  path: "/",
  // IMPORTANT: keep this in sync with JWT_ACCESS_EXPIRES (here we default to 15m)
  maxAge: 15 * 60 * 1000,
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
