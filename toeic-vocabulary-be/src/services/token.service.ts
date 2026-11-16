import { createHash, randomUUID } from "node:crypto";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import type { User } from "@prisma/client";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";

type AuthUser = Pick<User, "id" | "email">;
type RefreshPayload = JwtPayload & { sub: string; email: string; type: "refresh"; jti: string };
type AccessPayload = JwtPayload & { sub: string; email: string; type: "access" };

export const refreshCookieName = "toeic_refresh_token";

export const refreshCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.COOKIE_SECURE,
  path: "/api/auth",
  maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
};

export const clearRefreshCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.COOKIE_SECURE,
  path: "/api/auth",
};

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function signAccessToken(user: AuthUser) {
  return jwt.sign(
    { email: user.email, type: "access" },
    env.JWT_ACCESS_SECRET,
    { subject: user.id, expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"] },
  );
}

function createRefreshToken(user: AuthUser) {
  const tokenId = randomUUID();
  const token = jwt.sign(
    { email: user.email, type: "refresh" },
    env.JWT_REFRESH_SECRET,
    {
      subject: user.id,
      jwtid: tokenId,
      expiresIn: `${env.REFRESH_TOKEN_DAYS}d` as SignOptions["expiresIn"],
    },
  );
  return { token, tokenId };
}

export async function issueTokenPair(user: AuthUser) {
  const refresh = createRefreshToken(user);
  await prisma.refreshToken.create({
    data: {
      id: refresh.tokenId,
      userId: user.id,
      tokenHash: hashToken(refresh.token),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return { accessToken: signAccessToken(user), refreshToken: refresh.token };
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (
      typeof payload === "string" ||
      payload.type !== "access" ||
      !payload.sub ||
      typeof payload.email !== "string"
    ) {
      throw new Error("Invalid access token payload");
    }
    return payload as AccessPayload;
  } catch {
    throw new AppError(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.", "INVALID_ACCESS_TOKEN");
  }
}

export async function rotateRefreshToken(token: string) {
  let payload: RefreshPayload;
  try {
    const verified = jwt.verify(token, env.JWT_REFRESH_SECRET);
    if (
      typeof verified === "string" ||
      verified.type !== "refresh" ||
      !verified.sub ||
      !verified.jti ||
      typeof verified.email !== "string"
    ) {
      throw new Error("Invalid refresh token payload");
    }
    payload = verified as RefreshPayload;
  } catch {
    throw new AppError(401, "Phiên đăng nhập đã hết hạn.", "INVALID_REFRESH_TOKEN");
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (
    !stored ||
    stored.id !== payload.jti ||
    stored.userId !== payload.sub ||
    stored.revokedAt ||
    stored.expiresAt <= new Date()
  ) {
    throw new AppError(401, "Phiên đăng nhập đã hết hạn.", "INVALID_REFRESH_TOKEN");
  }

  const next = createRefreshToken(stored.user);
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        id: next.tokenId,
        userId: stored.userId,
        tokenHash: hashToken(next.token),
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  return {
    user: stored.user,
    accessToken: signAccessToken(stored.user),
    refreshToken: next.token,
  };
}

export async function revokeRefreshToken(token: string | undefined) {
  if (!token) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

