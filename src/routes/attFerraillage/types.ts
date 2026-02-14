import type { Request } from "express";

export type AuthedRequest = Request & { userId?: string };
