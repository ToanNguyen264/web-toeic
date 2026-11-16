import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";

export const AI_SETTING_KEYS = {
  elevenlabs: "elevenlabs_api_key",
  gemini: "gemini_api_key",
} as const;

type AiSettingName = (typeof AI_SETTING_KEYS)[keyof typeof AI_SETTING_KEYS];

const encryptionKey = createHash("sha256")
  .update(env.JWT_REFRESH_SECRET)
  .update("toeic-vocabulary-ai-settings-v1")
  .digest();

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encryptedValue = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    encryptedValue: encryptedValue.toString("base64url"),
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
  };
}

function decrypt(setting: { encryptedValue: string; iv: string; authTag: string }) {
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey,
      Buffer.from(setting.iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(setting.authTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(setting.encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AppError(
      500,
      "Không thể đọc cấu hình API đã mã hóa.",
      "AI_SETTINGS_DECRYPT_ERROR",
    );
  }
}

export async function getProviderApiKey(name: AiSettingName, fallback: string) {
  const setting = await prisma.appSetting.findUnique({ where: { key: name } });
  return setting ? decrypt(setting) : fallback;
}

function maskKey(value: string) {
  if (!value) return null;
  const visible = value.slice(-4);
  return `${"•".repeat(Math.min(12, Math.max(6, value.length - 4)))}${visible}`;
}

async function providerStatus(name: AiSettingName, fallback: string) {
  const setting = await prisma.appSetting.findUnique({ where: { key: name } });
  const value = setting ? decrypt(setting) : fallback;
  return {
    configured: Boolean(value),
    masked_key: maskKey(value),
    source: setting ? ("database" as const) : ("environment" as const),
    updated_at: setting?.updatedAt.toISOString() ?? null,
  };
}

export async function getAiSettingsStatus() {
  const [elevenlabs, gemini] = await Promise.all([
    providerStatus(AI_SETTING_KEYS.elevenlabs, env.ELEVENLABS_API_KEY),
    providerStatus(AI_SETTING_KEYS.gemini, env.GEMINI_API_KEY),
  ]);
  return { elevenlabs, gemini };
}

export async function updateAiSettings(values: {
  elevenlabsApiKey?: string;
  geminiApiKey?: string;
}) {
  const changes: Array<{ key: AiSettingName; value: string }> = [];
  if (values.elevenlabsApiKey) {
    changes.push({ key: AI_SETTING_KEYS.elevenlabs, value: values.elevenlabsApiKey });
  }
  if (values.geminiApiKey) {
    changes.push({ key: AI_SETTING_KEYS.gemini, value: values.geminiApiKey });
  }

  await prisma.$transaction(
    changes.map(({ key, value }) => {
      const encrypted = encrypt(value);
      return prisma.appSetting.upsert({
        where: { key },
        create: { key, ...encrypted },
        update: encrypted,
      });
    }),
  );

  return getAiSettingsStatus();
}
