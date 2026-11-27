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

export type ElevenLabsQuotaInfo = {
  valid: boolean;
  account_id: string | null;
  workspace_id: string | null;
  tier: string | null;
  status: string | null;
  used: number | null;
  limit: number | null;
  remaining: number | null;
  reset_at: string | null;
  checked_at: string;
  error: string | null;
};

export type ElevenLabsPoolKeyDto = {
  id: string;
  label: string;
  enabled: boolean;
  is_primary: boolean;
  priority: number;
  masked_key: string | null;
};

let elevenLabsConfigVersion = 0;

export function getElevenLabsConfigVersion() {
  return elevenLabsConfigVersion;
}

function bumpElevenLabsConfigVersion() {
  elevenLabsConfigVersion += 1;
}

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

async function setPrimaryElevenLabsKeyInDb(apiKey: string | null) {
  if (!apiKey) {
    await prisma.appSetting.deleteMany({ where: { key: AI_SETTING_KEYS.elevenlabs } });
    return;
  }
  const encrypted = encrypt(apiKey);
  await prisma.appSetting.upsert({
    where: { key: AI_SETTING_KEYS.elevenlabs },
    create: { key: AI_SETTING_KEYS.elevenlabs, ...encrypted },
    update: encrypted,
  });
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
  const pool = await readElevenLabsPool();
  const disabledRawKeys = new Set(
    pool.filter((key) => !key.enabled).map((key) => key.apiKey),
  );
  const enabledPool = pool
    .filter((key) => key.enabled)
    .sort((a, b) => a.priority - b.priority);
  const legacyKey = await getProviderApiKey(
    AI_SETTING_KEYS.elevenlabs,
    env.ELEVENLABS_API_KEY,
  );
  const candidates =
    legacyKey && !disabledRawKeys.has(legacyKey)
      ? [{ id: "legacy", apiKey: legacyKey }]
      : [];
  for (const key of enabledPool) {
    if (!candidates.some((candidate) => candidate.apiKey === key.apiKey)) {
      candidates.push({ id: key.id, apiKey: key.apiKey });
    }
  }
  return candidates;
}

async function inspectElevenLabsKey(apiKey: string): Promise<ElevenLabsQuotaInfo> {
  const checkedAt = new Date().toISOString();
  try {
    const headers = { "xi-api-key": apiKey };
    const [userResponse, subscriptionResponse] = await Promise.all([
      fetch(new URL("/v1/user", env.ELEVENLABS_API_BASE_URL), {
        headers,
        signal: AbortSignal.timeout(env.ELEVENLABS_TIMEOUT_MS),
      }).catch(() => null),
      fetch(new URL("/v1/user/subscription", env.ELEVENLABS_API_BASE_URL), {
        headers,
        signal: AbortSignal.timeout(env.ELEVENLABS_TIMEOUT_MS),
      }),
    ]);

    if (!subscriptionResponse.ok) {
      const errorMessage =
        subscriptionResponse.status === 401 || subscriptionResponse.status === 403
          ? "API key không hợp lệ hoặc chưa bật quyền đọc thông tin tài khoản (user_read)."
          : `ElevenLabs trả về mã lỗi ${subscriptionResponse.status}.`;
      return {
        valid: false,
        account_id: null,
        workspace_id: null,
        tier: null,
        status: null,
        used: null,
        limit: null,
        remaining: null,
        reset_at: null,
        checked_at: checkedAt,
        error: errorMessage,
      };
    }

    const user =
      userResponse && userResponse.ok
        ? ((await userResponse.json()) as {
            workspace_id?: string;
            user_id?: string;
          })
        : null;
    const subscription = (await subscriptionResponse.json()) as {
      tier?: string;
      status?: string;
      character_count?: number;
      character_limit?: number;
      next_character_count_reset_unix?: number | null;
    };

    const used =
      typeof subscription.character_count === "number"
        ? subscription.character_count
        : null;
    const limit =
      typeof subscription.character_limit === "number"
        ? subscription.character_limit
        : null;
    const remaining =
      used !== null && limit !== null ? Math.max(0, limit - used) : null;
    const resetAt =
      typeof subscription.next_character_count_reset_unix === "number" &&
      subscription.next_character_count_reset_unix > 0
        ? new Date(subscription.next_character_count_reset_unix * 1000).toISOString()
        : null;
    const workspaceId = user?.workspace_id ?? null;
    const accountId = workspaceId
      ? `ws:${workspaceId}`
      : user?.user_id
        ? `user:${user.user_id}`
        : null;

    return {
      valid: true,
      account_id: accountId,
      workspace_id: workspaceId,
      tier: subscription.tier ?? null,
      status: subscription.status ?? null,
      used,
      limit,
      remaining,
      reset_at: resetAt,
      checked_at: checkedAt,
      error: null,
    };
  } catch {
    return {
      valid: false,
      account_id: null,
      workspace_id: null,
      tier: null,
      status: null,
      used: null,
      limit: null,
      remaining: null,
      reset_at: null,
      checked_at: checkedAt,
      error: "Không thể kết nối ElevenLabs để kiểm tra key.",
    };
  }
}

function toPoolKeyDto(
  key: StoredElevenLabsKey,
  activePrimaryKey: string,
): ElevenLabsPoolKeyDto {
  return {
    id: key.id,
    label: key.label,
    enabled: key.enabled,
    is_primary: Boolean(activePrimaryKey) && key.enabled && key.apiKey === activePrimaryKey,
    priority: key.priority,
    masked_key: maskKey(key.apiKey),
  };
}

async function resolveEffectivePrimaryKey(pool: StoredElevenLabsKey[]) {
  const disabledRawKeys = new Set(
    pool.filter((key) => !key.enabled).map((key) => key.apiKey),
  );
  const rawPrimary = await getProviderApiKey(
    AI_SETTING_KEYS.elevenlabs,
    env.ELEVENLABS_API_KEY,
  );
  if (rawPrimary && !disabledRawKeys.has(rawPrimary)) {
    return rawPrimary;
  }
  const firstEnabled = [...pool]
    .filter((key) => key.enabled)
    .sort((a, b) => a.priority - b.priority)[0];
  return firstEnabled?.apiKey ?? "";
}

export async function listElevenLabsKeys(): Promise<ElevenLabsPoolKeyDto[]> {
  const pool = (await readElevenLabsPool()).sort((a, b) => a.priority - b.priority);
  const activePrimary = await resolveEffectivePrimaryKey(pool);
  return pool.map((key) => toPoolKeyDto(key, activePrimary));
}

export async function addElevenLabsKey(label: string, apiKey: string) {
  const pool = await readElevenLabsPool();
  if (pool.some((key) => key.apiKey === apiKey)) {
    throw new AppError(409, "API key này đã có trong danh sách.", "ELEVENLABS_KEY_EXISTS");
  }
  const quota = await inspectElevenLabsKey(apiKey);
  if (!quota.valid) {
    throw new AppError(
      400,
      quota.error ?? "ElevenLabs API key không hợp lệ.",
      "ELEVENLABS_KEY_INVALID",
    );
  }
  const addedId = randomUUID();
  pool.push({
    id: addedId,
    label,
    apiKey,
    enabled: true,
    priority: pool.length + 1,
  });
  await writeElevenLabsPool(pool);

  const currentPrimary = await resolveEffectivePrimaryKey(pool);
  if (!currentPrimary) {
    await setPrimaryElevenLabsKeyInDb(apiKey);
  }
  bumpElevenLabsConfigVersion();

  const [keys, settings] = await Promise.all([
    listElevenLabsKeys(),
    getAiSettingsStatus(),
  ]);
  return {
    keys,
    settings,
    addedId,
    quota,
  };
}

export async function activateElevenLabsKey(id: string) {
  const pool = await readElevenLabsPool();
  const key = pool.find((item) => item.id === id);
  if (!key) {
    throw new AppError(404, "Không tìm thấy API key.", "ELEVENLABS_KEY_NOT_FOUND");
  }
  if (!key.enabled) {
    key.enabled = true;
    await writeElevenLabsPool(pool);
  }
  await setPrimaryElevenLabsKeyInDb(key.apiKey);
  bumpElevenLabsConfigVersion();

  const [keys, settings] = await Promise.all([
    listElevenLabsKeys(),
    getAiSettingsStatus(),
  ]);
  return { keys, settings };
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

  if (values.enabled === false) {
    const dbPrimary = await prisma.appSetting.findUnique({
      where: { key: AI_SETTING_KEYS.elevenlabs },
    });
    if (dbPrimary && decrypt(dbPrimary) === key.apiKey) {
      const nextEnabled = [...pool]
        .filter((item) => item.enabled)
        .sort((a, b) => a.priority - b.priority)[0];
      await setPrimaryElevenLabsKeyInDb(nextEnabled?.apiKey ?? null);
    }
  }
  bumpElevenLabsConfigVersion();

  const [keys, settings] = await Promise.all([
    listElevenLabsKeys(),
    getAiSettingsStatus(),
  ]);
  return { keys, settings };
}

export async function deleteElevenLabsKey(id: string) {
  const pool = await readElevenLabsPool();
  const removedKey = pool.find((key) => key.id === id);
  if (!removedKey) {
    throw new AppError(404, "Không tìm thấy API key.", "ELEVENLABS_KEY_NOT_FOUND");
  }
  const nextPool = pool
    .filter((key) => key.id !== id)
    .map((key, index) => ({ ...key, priority: index + 1 }));
  await writeElevenLabsPool(nextPool);

  const dbPrimary = await prisma.appSetting.findUnique({
    where: { key: AI_SETTING_KEYS.elevenlabs },
  });
  if (dbPrimary && decrypt(dbPrimary) === removedKey.apiKey) {
    const nextEnabled = nextPool.find((item) => item.enabled);
    await setPrimaryElevenLabsKeyInDb(nextEnabled?.apiKey ?? null);
  }
  bumpElevenLabsConfigVersion();

  const [keys, settings] = await Promise.all([
    listElevenLabsKeys(),
    getAiSettingsStatus(),
  ]);
  return { keys, settings };
}

export async function checkDefaultElevenLabsKey() {
  const pool = await readElevenLabsPool();
  const effectiveKey = await resolveEffectivePrimaryKey(pool);
  if (!effectiveKey) {
    throw new AppError(
      400,
      "Hiện chưa có ElevenLabs API key nào đang bật để kiểm tra.",
      "ELEVENLABS_DEFAULT_NOT_CONFIGURED",
    );
  }
  const quota = await inspectElevenLabsKey(effectiveKey);
  return { quota };
}

export async function checkPoolElevenLabsKey(id: string) {
  const pool = await readElevenLabsPool();
  const key = pool.find((item) => item.id === id);
  if (!key) {
    throw new AppError(404, "Không tìm thấy API key.", "ELEVENLABS_KEY_NOT_FOUND");
  }
  const quota = await inspectElevenLabsKey(key.apiKey);
  return { id: key.id, quota };
}

export async function checkAllElevenLabsKeys() {
  const pool = (await readElevenLabsPool()).sort((a, b) => a.priority - b.priority);
  const effectivePrimaryKey = await resolveEffectivePrimaryKey(pool);
  const primaryMatchesPoolKey = pool.find(
    (item) => item.apiKey === effectivePrimaryKey,
  );

  const [standalonePrimaryQuota, poolResults] = await Promise.all([
    effectivePrimaryKey && !primaryMatchesPoolKey
      ? inspectElevenLabsKey(effectivePrimaryKey)
      : Promise.resolve(null),
    Promise.all(
      pool.map(async (key) => ({
        key,
        quota: await inspectElevenLabsKey(key.apiKey),
      })),
    ),
  ]);

  const keyQuotas: Record<string, ElevenLabsQuotaInfo> = {};
  for (const item of poolResults) {
    keyQuotas[item.key.id] = item.quota;
  }

  const defaultQuota = primaryMatchesPoolKey
    ? (keyQuotas[primaryMatchesPoolKey.id] ?? null)
    : standalonePrimaryQuota;

  const seenAccounts = new Set<string>();
  const seenRawKeys = new Set<string>();
  let totalRemaining = 0;
  let totalLimit = 0;
  let totalUsed = 0;
  let activeKeyCount = 0;

  function accumulateActiveKey(rawApiKey: string, quota: ElevenLabsQuotaInfo) {
    if (!quota.valid) return;
    if (seenRawKeys.has(rawApiKey)) return;
    seenRawKeys.add(rawApiKey);
    activeKeyCount += 1;

    const dedupeId = quota.account_id ?? `raw:${rawApiKey}`;
    if (seenAccounts.has(dedupeId)) return;
    seenAccounts.add(dedupeId);

    if (typeof quota.remaining === "number") totalRemaining += quota.remaining;
    if (typeof quota.limit === "number") totalLimit += quota.limit;
    if (typeof quota.used === "number") totalUsed += quota.used;
  }

  if (effectivePrimaryKey && defaultQuota) {
    accumulateActiveKey(effectivePrimaryKey, defaultQuota);
  }
  for (const { key, quota } of poolResults) {
    if (key.enabled) {
      accumulateActiveKey(key.apiKey, quota);
    }
  }

  return {
    defaultQuota,
    keyQuotas,
    summary: {
      total_remaining: totalRemaining,
      total_limit: totalLimit,
      total_used: totalUsed,
      active_key_count: activeKeyCount,
      unique_account_count: seenAccounts.size,
      checked_at: new Date().toISOString(),
    },
  };
}

async function elevenLabsStatus() {
  const [setting, pool] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: AI_SETTING_KEYS.elevenlabs } }),
    readElevenLabsPool(),
  ]);
  const effectiveValue = await resolveEffectivePrimaryKey(pool);
  const matchedPoolKey = effectiveValue
    ? pool.find((item) => item.enabled && item.apiKey === effectiveValue)
    : undefined;
  return {
    configured: Boolean(effectiveValue),
    masked_key: maskKey(effectiveValue),
    active_label: matchedPoolKey?.label ?? null,
    source:
      setting || matchedPoolKey ? ("database" as const) : ("environment" as const),
    updated_at: setting?.updatedAt.toISOString() ?? null,
  };
}

async function providerStatus(name: AiSettingName, fallback: string) {
  const setting = await prisma.appSetting.findUnique({ where: { key: name } });
  const value = setting ? decrypt(setting) : fallback;
  return {
    configured: Boolean(value),
    masked_key: maskKey(value),
    active_label: null as string | null,
    source: setting ? ("database" as const) : ("environment" as const),
    updated_at: setting?.updatedAt.toISOString() ?? null,
  };
}

export async function getAiSettingsStatus() {
  const [elevenlabs, gemini] = await Promise.all([
    elevenLabsStatus(),
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
  if (values.elevenlabsApiKey) bumpElevenLabsConfigVersion();

  return getAiSettingsStatus();
}
