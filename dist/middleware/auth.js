"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function requireAuth(req, res, next) {
    const token = req.cookies?.access_token;
    if (!token)
        return res.status(401).json({ error: "Unauthorized" });
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_ACCESS_SECRET);
        req.userId = payload.sub;
        next();
    }
    catch {
        return res.status(401).json({ error: "Unauthorized" });
    }
}
