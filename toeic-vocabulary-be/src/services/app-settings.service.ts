import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";

export const AI_SETTING_KEYS = {
  elevenlabs: "elevenlabs_api_key",
  elevenlabsPool: "elevenlabs_api_key_pool",
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

type StoredElevenLabsKey = {
  id: string;
  label: string;
  apiKey: string;
  enabled: boolean;
  priority: number;
};

async function readElevenLabsPool(): Promise<StoredElevenLabsKey[]> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: AI_SETTING_KEYS.elevenlabsPool },
  });
  if (!setting) return [];
  try {
    const parsed = JSON.parse(decrypt(setting)) as StoredElevenLabsKey[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new AppError(500, "Không thể đọc danh sách ElevenLabs API key.", "AI_KEY_POOL_INVALID");
  }
}

async function writeElevenLabsPool(keys: StoredElevenLabsKey[]) {
  const encrypted = encrypt(JSON.stringify(keys));
  await prisma.appSetting.upsert({
    where: { key: AI_SETTING_KEYS.elevenlabsPool },
    create: { key: AI_SETTING_KEYS.elevenlabsPool, ...encrypted },
    update: encrypted,
  });
}

export async function getElevenLabsApiKeys() {
  const pool = (await readElevenLabsPool())
    .filter((key) => key.enabled)
    .sort((a, b) => a.priority - b.priority);
  const legacyKey = await getProviderApiKey(
    AI_SETTING_KEYS.elevenlabs,
    env.ELEVENLABS_API_KEY,
  );
  const candidates = legacyKey ? [{ id: "legacy", apiKey: legacyKey }] : [];
  for (const key of pool) {
    if (!candidates.some((candidate) => candidate.apiKey === key.apiKey)) {
      candidates.push({ id: key.id, apiKey: key.apiKey });
    }
  }
  return candidates;
}

async function inspectElevenLabsKey(apiKey: string) {
  try {
    const headers = { "xi-api-key": apiKey };
    const [userResponse, subscriptionResponse] = await Promise.all([
      fetch(new URL("/v1/user", env.ELEVENLABS_API_BASE_URL), {
        headers,
        signal: AbortSignal.timeout(env.ELEVENLABS_TIMEOUT_MS),
      }),
      fetch(new URL("/v1/user/subscription", env.ELEVENLABS_API_BASE_URL), {
        headers,
        signal: AbortSignal.timeout(env.ELEVENLABS_TIMEOUT_MS),
      }),
    ]);
    if (!userResponse.ok || !subscriptionResponse.ok) {
      return { valid: false, error: `ElevenLabs trả về ${userResponse.status || subscriptionResponse.status}.` };
    }
    const user = (await userResponse.json()) as { workspace_id?: string };
    const subscription = (await subscriptionResponse.json()) as {
      tier?: string;
      character_count?: number;
      character_limit?: number;
    };
    return {
      valid: true,
      workspace_id: user.workspace_id ?? null,
      tier: subscription.tier ?? null,
      used: subscription.character_count ?? null,
      limit: subscription.character_limit ?? null,
      remaining:
        typeof subscription.character_count === "number" &&
        typeof subscription.character_limit === "number"
          ? Math.max(0, subscription.character_limit - subscription.character_count)
          : null,
      error: null,
    };
  } catch {
    return { valid: false, error: "Không thể kết nối ElevenLabs để kiểm tra key." };
  }
}

export async function listElevenLabsKeys() {
  const pool = (await readElevenLabsPool()).sort((a, b) => a.priority - b.priority);
  return Promise.all(
    pool.map(async (key) => ({
      id: key.id,
      label: key.label,
      enabled: key.enabled,
      priority: key.priority,
      masked_key: maskKey(key.apiKey),
      ...(await inspectElevenLabsKey(key.apiKey)),
    })),
  );
}

export async function addElevenLabsKey(label: string, apiKey: string) {
  const inspection = await inspectElevenLabsKey(apiKey);
  if (!inspection.valid) {
    throw new AppError(400, inspection.error ?? "ElevenLabs API key không hợp lệ.", "ELEVENLABS_KEY_INVALID");
  }
  const pool = await readElevenLabsPool();
  if (pool.some((key) => key.apiKey === apiKey)) {
    throw new AppError(409, "API key này đã có trong danh sách.", "ELEVENLABS_KEY_EXISTS");
  }
  pool.push({
    id: randomUUID(),
    label,
    apiKey,
    enabled: true,
    priority: pool.length + 1,
  });
  await writeElevenLabsPool(pool);
  return listElevenLabsKeys();
}

export async function updateElevenLabsKey(
  id: string,
  values: { label?: string; enabled?: boolean },
) {
  const pool = await readElevenLabsPool();
  const key = pool.find((item) => item.id === id);
  if (!key) throw new AppError(404, "Không tìm thấy API key.", "ELEVENLABS_KEY_NOT_FOUND");
  if (values.label !== undefined) key.label = values.label;
  if (values.enabled !== undefined) key.enabled = values.enabled;
  await writeElevenLabsPool(pool);
  return listElevenLabsKeys();
}

export async function deleteElevenLabsKey(id: string) {
  const pool = await readElevenLabsPool();
  const nextPool = pool.filter((key) => key.id !== id);
  if (nextPool.length === pool.length) {
    throw new AppError(404, "Không tìm thấy API key.", "ELEVENLABS_KEY_NOT_FOUND");
  }
  await writeElevenLabsPool(
    nextPool.map((key, index) => ({ ...key, priority: index + 1 })),
  );
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
