import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { authRouter } from "@/routes/auth.routes";
import { meRouter } from "@/routes/me.routes";


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

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.use("/auth", authRouter);
  app.use("/me", meRouter);

  app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err: unknown, req: any, res: any, next: any) => {
  console.error(err);

  const message = err instanceof Error ? err.message : "Server error";

  if (process.env.NODE_ENV !== "production") {
    return res.status(500).json({ error: message });
  }

  return res.status(500).json({ error: "Server error" });
});

  return app;
}
