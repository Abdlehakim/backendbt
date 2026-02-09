import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@/db";

export const authRouter = Router();

const schema = z.object({
  email: z.string().email().max(190),
  password: z.string().min(8).max(100),
});

// Validate env once (fixes TS overload + avoids runtime surprises)
const JWT_SECRET = process.env.JWT_ACCESS_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_ACCESS_SECRET is missing in .env");
}

const JWT_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES ?? "15m") as SignOptions["expiresIn"];

function setCookie(res: any, token: string) {
  res.cookie("access_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60 * 1000,
  });
}

authRouter.post("/signup", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { email, password } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Email already used" });

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      subscription: { create: { status: "inactive" } },
    },
    select: { id: true, email: true },
  });

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  setCookie(res, token);
  res.status(201).json({ user });
});

authRouter.post("/login", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  setCookie(res, token);
  res.json({ ok: true });
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie("access_token");
  res.json({ ok: true });
});
