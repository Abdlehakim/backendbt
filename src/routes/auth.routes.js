"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const db_1 = require("@/db");
exports.authRouter = (0, express_1.Router)();
const schema = zod_1.z.object({
    email: zod_1.z.string().email().max(190),
    password: zod_1.z.string().min(8).max(100),
});
// Validate env once (fixes TS overload + avoids runtime surprises)
const JWT_SECRET = process.env.JWT_ACCESS_SECRET;
if (!JWT_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is missing in .env");
}
const JWT_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES ?? "15m");
function setCookie(res, token) {
    res.cookie("access_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
    });
}
exports.authRouter.post("/signup", async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "Invalid input" });
    const { email, password } = parsed.data;
    const exists = await db_1.prisma.user.findUnique({ where: { email } });
    if (exists)
        return res.status(409).json({ error: "Email already used" });
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    const user = await db_1.prisma.user.create({
        data: {
            email,
            passwordHash,
            subscription: { create: { status: "inactive" } },
        },
        select: { id: true, email: true },
    });
    const token = jsonwebtoken_1.default.sign({ sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    setCookie(res, token);
    res.status(201).json({ user });
});
exports.authRouter.post("/login", async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "Invalid input" });
    const { email, password } = parsed.data;
    const user = await db_1.prisma.user.findUnique({ where: { email } });
    if (!user)
        return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!ok)
        return res.status(401).json({ error: "Invalid credentials" });
    const token = jsonwebtoken_1.default.sign({ sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    setCookie(res, token);
    res.json({ ok: true });
});
exports.authRouter.post("/logout", (req, res) => {
    res.clearCookie("access_token");
    res.json({ ok: true });
});
