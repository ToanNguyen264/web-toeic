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
  ADMIN_EMAIL: z.string().trim().toLowerCase().email().default("toan@gmail.com"),
  AUDIO_STORAGE_DIR: z.string().min(1).default("./uploads/audio"),
  TTS_PROVIDER: z.enum(["free", "elevenlabs"]).default("free"),
  ELEVENLABS_API_KEY: z.string().trim().default(""),
  ELEVENLABS_VOICE_ID: z.string().trim().default(""),
  ELEVENLABS_MODEL_ID: z.string().trim().min(1).default("eleven_flash_v2_5"),
  ELEVENLABS_VI_VOICE_ID: z.string().trim().default(""),
  ELEVENLABS_VI_MODEL_ID: z.string().trim().min(1).default("eleven_flash_v2_5"),
  VIETNAMESE_TTS_PROVIDER: z.enum(["edge", "elevenlabs"]).default("edge"),
  VIETNAMESE_EDGE_VOICE: z.string().trim().min(1).default("vi-VN-HoaiMyNeural"),
  VIETNAMESE_EDGE_RATE: z.string().trim().min(1).default("+0%"),
  ENGLISH_FALLBACK_EDGE_VOICE: z
    .string()
    .trim()
    .min(1)
    .default("en-US-AvaMultilingualNeural"),
  ENGLISH_FALLBACK_EDGE_RATE: z.string().trim().min(1).default("+0%"),
  ELEVENLABS_API_BASE_URL: z.string().url().default("https://api.elevenlabs.io"),
  ELEVENLABS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(15_000),
  GEMINI_API_KEY: z.string().trim().default(""),
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-3.1-flash-lite"),
  GEMINI_API_BASE_URL: z.string().url().default("https://generativelanguage.googleapis.com"),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(20_000),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Cấu hình môi trường backend không hợp lệ:", z.flattenError(parsed.error));
  throw new Error("Invalid backend environment configuration");
}

export const env = parsed.data;

