import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;
    (req as any).userId = payload.sub as string;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
