import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, "Không tìm thấy API được yêu cầu.", "NOT_FOUND"));
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  void _next;
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Dữ liệu gửi lên không hợp lệ.",
      code: "VALIDATION_ERROR",
      details: error.issues,
    });
  }
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "File audio không được vượt quá 5 MB." : "Không thể nhận file tải lên.";
    return res.status(400).json({ message, code: error.code });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return res.status(409).json({ message: "Dữ liệu này đã tồn tại.", code: "CONFLICT" });
  }
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ message: error.message, code: error.code, details: error.details });
  }

  req.log?.error({ err: error }, "Unhandled request error");
  return res.status(500).json({
    message: "Máy chủ gặp lỗi. Vui lòng thử lại sau.",
    code: "INTERNAL_ERROR",
    ...(env.NODE_ENV === "development" && error instanceof Error ? { details: error.message } : {}),
  });
}

