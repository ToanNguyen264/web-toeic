import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
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

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth || req.auth.email.toLowerCase() !== env.ADMIN_EMAIL) {
    return next(
      new AppError(403, "Bạn không có quyền truy cập cấu hình quản trị.", "ADMIN_REQUIRED"),
    );
  }
  next();
}

