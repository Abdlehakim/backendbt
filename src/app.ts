import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { authRouter } from "@/routes/auth.routes";
import { meRouter } from "@/routes/me.routes";
import { onboardingRouter } from "@/routes/onboarding.routes";
import { modulesRouter } from "@/routes/modules.routes";

import { requireAuth } from "@/middleware/auth";
import { requireSubscriptionValid, requireModulesSelected } from "@/middleware/subscription";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    })
  );

  app.get("/", (_req, res) => res.status(200).send("OK"));
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // ✅ Public
  app.use("/auth", authRouter);

  // ✅ Authenticated
  app.use("/me", requireAuth, meRouter);

  // ✅ Onboarding must be accessible after login,
  // even if subscription/modules not completed yet
  app.use("/onboarding", requireAuth, onboardingRouter);

  // ✅ Modules catalog + selection should require auth + valid subscription (plan must be selected)
  // If you want catalog available before plan, remove requireSubscriptionValid here.
  app.use("/modules", requireAuth, requireSubscriptionValid, modulesRouter);

  // ✅ App/Dashboard APIs must require modules selected
  // (If you later create appRouter, replace the handler with appRouter)
  app.use("/app", requireAuth, requireSubscriptionValid, requireModulesSelected, (_req, res) => {
    return res.json({ ok: true });
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  app.use((err: unknown, _req: any, res: any, _next: any) => {
    console.error(err);
    const message = err instanceof Error ? err.message : "Server error";
    if (process.env.NODE_ENV !== "production") return res.status(500).json({ error: message });
    return res.status(500).json({ error: "Server error" });
  });

  return app;
}
