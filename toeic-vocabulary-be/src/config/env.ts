import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_HOST: z.string().min(1).default("localhost"),
  DATABASE_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DATABASE_USER: z.string().min(1).default("toeic_user"),
  DATABASE_PASSWORD: z.string().min(1).default("toeic_password"),
  DATABASE_NAME: z.string().min(1).default("toeic_vocabulary"),
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  COOKIE_SECURE: booleanFromString,
  AUDIO_STORAGE_DIR: z.string().min(1).default("./uploads/audio"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Cấu hình môi trường backend không hợp lệ:", z.flattenError(parsed.error));
  throw new Error("Invalid backend environment configuration");
}

export const env = parsed.data;

