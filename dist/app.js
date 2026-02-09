"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_routes_1 = require("./routes/auth.routes");
const me_routes_1 = require("./routes/me.routes");
function createApp() {
    const app = (0, express_1.default)();
    app.set("trust proxy", 1);
    app.use((0, helmet_1.default)());
    app.use((0, morgan_1.default)(process.env.NODE_ENV === "production" ? "combined" : "dev"));
    app.use(express_1.default.json({ limit: "1mb" }));
    app.use((0, cookie_parser_1.default)());
    app.use((0, express_rate_limit_1.default)({
        windowMs: 60_000,
        max: 120,
        standardHeaders: true,
        legacyHeaders: false,
    }));
    app.use((0, cors_1.default)({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
    }));
    app.get("/health", (req, res) => res.json({ ok: true }));
    app.use("/auth", auth_routes_1.authRouter);
    app.use("/me", me_routes_1.meRouter);
    app.use((req, res) => res.status(404).json({ error: "Not found" }));
    app.use((err, req, res, next) => {
        console.error(err);
        const message = err instanceof Error ? err.message : "Server error";
        if (process.env.NODE_ENV !== "production") {
            return res.status(500).json({ error: message });
        }
        return res.status(500).json({ error: "Server error" });
    });
    return app;
}
