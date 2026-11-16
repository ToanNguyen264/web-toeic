import bcrypt from "bcrypt";
import { Router } from "express";
import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  clearRefreshCookieOptions,
  issueTokenPair,
  refreshCookieName,
  refreshCookieOptions,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../services/token.service.js";
import { userDto } from "../utils/dto.js";
import { credentialsSchema } from "../utils/validation.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const credentials = credentialsSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: credentials.email } });
  if (existing) throw new AppError(409, "Email này đã được đăng ký.", "EMAIL_EXISTS");

  const user = await prisma.user.create({
    data: {
      email: credentials.email,
      passwordHash: await bcrypt.hash(credentials.password, 12),
    },
  });
  const tokens = await issueTokenPair(user);
  res.cookie(refreshCookieName, tokens.refreshToken, refreshCookieOptions);
  res.status(201).json({ user: userDto(user), accessToken: tokens.accessToken });
});

authRouter.post("/login", async (req, res) => {
  const credentials = credentialsSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: credentials.email } });
  if (!user || !(await bcrypt.compare(credentials.password, user.passwordHash))) {
    throw new AppError(401, "Email hoặc mật khẩu không đúng.", "INVALID_CREDENTIALS");
  }

  const tokens = await issueTokenPair(user);
  res.cookie(refreshCookieName, tokens.refreshToken, refreshCookieOptions);
  res.json({ user: userDto(user), accessToken: tokens.accessToken });
});

authRouter.post("/refresh", async (req, res) => {
  const currentToken = req.cookies[refreshCookieName] as string | undefined;
  if (!currentToken) throw new AppError(401, "Phiên đăng nhập đã hết hạn.", "REFRESH_TOKEN_REQUIRED");

  const result = await rotateRefreshToken(currentToken);
  res.cookie(refreshCookieName, result.refreshToken, refreshCookieOptions);
  res.json({ user: userDto(result.user), accessToken: result.accessToken });
});

authRouter.post("/logout", async (req, res) => {
  await revokeRefreshToken(req.cookies[refreshCookieName] as string | undefined);
  res.clearCookie(refreshCookieName, clearRefreshCookieOptions);
  res.status(204).send();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) throw new AppError(404, "Không tìm thấy tài khoản.", "USER_NOT_FOUND");
  res.json({ user: userDto(user) });
});

