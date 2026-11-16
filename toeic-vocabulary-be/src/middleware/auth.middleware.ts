import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";
import { verifyAccessToken } from "../services/token.service.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return next(new AppError(401, "Vui lòng đăng nhập để tiếp tục.", "AUTH_REQUIRED"));
  }
  const payload = verifyAccessToken(authorization.slice(7));
  req.auth = { userId: payload.sub, email: payload.email };
  next();
}

