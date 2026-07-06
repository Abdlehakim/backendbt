import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@/db";

export const authRouter = Router();

const loginSchema = z.object({
  countryCode: z.string().trim().min(1).max(10),
  phone: z.string().trim().min(3).max(40),
  password: z.string().min(8).max(100),
});

const signupSchema = z.object({
  name: z.string().trim().min(1).max(120).optional().or(z.literal("")),
  countryCode: z.string().trim().min(1).max(10),
  phone: z.string().trim().min(3).max(40),
  email: z.string().email().max(190),
  password: z.string().min(8).max(100),
  accountType: z.enum(["INDIVIDUAL", "ENTERPRISE"]).default("INDIVIDUAL"),
  companyName: z.string().trim().max(190).optional().or(z.literal("")),
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

const cookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
  sameSite: (process.env.COOKIE_SAMESITE ?? "lax") as "lax" | "strict" | "none",
  path: "/",
  maxAge: cookieMaxAgeMs,
};

function setAuthCookie(res: Response, token: string) {
  res.cookie("access_token", token, cookieOptions);
}

function clearAuthCookie(res: Response) {
  res.clearCookie("access_token", cookieOptions);
}

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const email = parsed.data.email.trim().toLowerCase();
  const countryCode = normalizeCountryCode(parsed.data.countryCode);
  const phone = normalizePhone(countryCode, parsed.data.phone);
  const password = parsed.data.password;
  const name = parsed.data.name?.trim() || null;
  const accountType = parsed.data.accountType;
  const seats = accountType === "INDIVIDUAL" ? 1 : 5;
  const accountName =
    accountType === "ENTERPRISE"
      ? (parsed.data.companyName?.trim() || parsed.data.name?.trim() || email)
      : (parsed.data.name?.trim() || email);

  if (!countryCode || !phone) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  const existsByEmail = await prisma.user.findUnique({ where: { email } });
  if (existsByEmail) return res.status(409).json({ error: "Email already used" });

  const existsByPhone = await prisma.user.findUnique({ where: { phone } });
  if (existsByPhone) return res.status(409).json({ error: "Phone already used" });

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      countryCode,
      phone,
      role: "OWNER",
      subscription: {
        create: {
          status: "INACTIVE",
          plan: accountType,
          seats,
          accountName,
        },
      },
    },
    select: { id: true, email: true, name: true, countryCode: true, phone: true, role: true },
  });

  const token = jwt.sign({}, JWT_SECRET, { subject: user.id, expiresIn: JWT_EXPIRES_IN });

  setAuthCookie(res, token);
  return res.status(201).json({ user });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const countryCode = normalizeCountryCode(parsed.data.countryCode);
  const phone = normalizePhone(countryCode, parsed.data.phone);
  const password = parsed.data.password;

  if (!countryCode || !phone) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
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
