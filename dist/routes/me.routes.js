"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.meRouter = (0, express_1.Router)();
exports.meRouter.get("/", auth_1.requireAuth, async (req, res) => {
    const userId = req.userId;
    const user = await db_1.prisma.user.findUnique({
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
