import jwt, { JwtPayload } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) return res.status(500).json({ error: "Server misconfigured" });

  try {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded !== "object" || decoded === null) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = decoded as JwtPayload;
    const userId = typeof payload.sub === "string" ? payload.sub : null;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    req.userId = userId;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
