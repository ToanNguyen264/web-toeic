import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { apiRequest } from "../../lib/api";
import { useToast } from "../../hooks/useToast";
import { toUserMessage } from "../../utils/errors";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

type ProviderStatus = {
  configured: boolean;
  masked_key: string | null;
  active_label?: string | null;
  source: "database" | "environment";
  updated_at: string | null;
};

type AiSettingsStatus = {
  elevenlabs: ProviderStatus;
  gemini: ProviderStatus;
};

type ElevenLabsQuotaInfo = {
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

type ElevenLabsPoolKey = {
  id: string;
  label: string;
  enabled: boolean;
  is_primary: boolean;
  priority: number;
  masked_key: string | null;
};

type CheckAllSummary = {
  total_remaining: number;
  total_limit: number;
  total_used: number;
  active_key_count: number;
  unique_account_count: number;
  checked_at: string;
};

type CheckAllResponse = {
  defaultQuota: ElevenLabsQuotaInfo | null;
  keyQuotas: Record<string, ElevenLabsQuotaInfo>;
  summary: CheckAllSummary;
};

type PoolMutationResponse = {
  keys: ElevenLabsPoolKey[];
  settings: AiSettingsStatus;
};

type AiSettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

function formatResetDate(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function QuotaDetailsPanel({ quota }: { quota: ElevenLabsQuotaInfo }) {
  if (!quota.valid) {
    return (
      <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/50 dark:text-rose-300">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{quota.error ?? "Không thể kiểm tra API key này."}</span>
      </div>
    );
  }

  const remaining = quota.remaining ?? 0;
  const limit = quota.limit ?? 0;
  const used = quota.used ?? 0;
  const hasNumbers = quota.remaining !== null && quota.limit !== null && limit > 0;
  const remainPercent = hasNumbers
    ? Math.max(0, Math.min(100, Math.round((remaining / limit) * 100)))
    : 0;
  const barColor =
    remainPercent <= 10
      ? "bg-rose-500"
      : remainPercent <= 30
        ? "bg-amber-500"
        : "bg-emerald-500";
  const resetFormatted = formatResetDate(quota.reset_at);

  return (
    <div className="mt-2.5 space-y-2 rounded-xl border border-slate-200/90 bg-slate-50/90 p-3 text-xs dark:border-slate-700/80 dark:bg-slate-950/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          {quota.remaining !== null ? (
            <>
              Còn{" "}
              <strong className="text-sm text-indigo-700 dark:text-indigo-300">
                {remaining.toLocaleString("vi-VN")}
              </strong>
              {quota.limit !== null && (
                <span className="font-normal text-slate-500">
                  {" "}
                  / {limit.toLocaleString("vi-VN")} token ({remainPercent}%)
                </span>
              )}
            </>
          ) : (
            "Key hợp lệ"
          )}
        </span>

        <span className="rounded-full bg-white px-2.5 py-0.5 font-semibold text-slate-600 shadow-2xs dark:bg-slate-800 dark:text-slate-300">
          Gói: {quota.tier ?? "—"}
        </span>
      </div>

      {hasNumbers && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${remainPercent}%` }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          Đã dùng: {quota.used !== null ? used.toLocaleString("vi-VN") : "—"}
          {quota.workspace_id ? ` · WS: ${quota.workspace_id.slice(0, 8)}…` : ""}
        </span>
        {resetFormatted && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Làm mới: {resetFormatted}
          </span>
        )}
      </div>
    </div>
  );
}

function ActiveElevenLabsCard({
  status,
  onCheckQuota,
  checkingQuota,
  quota,
}: {
  status?: ProviderStatus;
  onCheckQuota: () => void;
  checkingQuota: boolean;
  quota: ElevenLabsQuotaInfo | null;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-900 dark:text-white">
            ElevenLabs (Key đang dùng)
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Key chính được ưu tiên gọi đầu tiên; khi hết token hoặc lỗi sẽ tự xoay sang các key đang bật trong kho bên dưới.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {status?.configured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {status.active_label
                ? `Đang dùng: ${status.active_label}`
                : status.source === "database"
                  ? "Đã lưu DB"
                  : "Từ .env"}
            </span>
          )}
          {status?.configured && (
            <button
              type="button"
              onClick={onCheckQuota}
              disabled={checkingQuota}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-2xs transition hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950"
            >
              {checkingQuota ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Activity className="h-3.5 w-3.5" />
              )}
              Kiểm tra số dư
            </button>
          )}
        </div>
      </div>

      <div className="mt-3.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
        <span className="text-slate-500 dark:text-slate-400">Key hiện tại: </span>
        <span className="break-all font-mono font-semibold text-slate-700 dark:text-slate-200">
          {status?.masked_key ?? "Chưa có key nào đang bật"}
        </span>
      </div>

      {quota && <QuotaDetailsPanel quota={quota} />}
    </section>
  );
}

function GeminiProviderCard({
  status,
  value,
  onChange,
}: {
  status?: ProviderStatus;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-900 dark:text-white">Google Gemini</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Dùng để tạo câu ví dụ theo ngữ cảnh TOEIC.
          </p>
        </div>
        {status?.configured && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {status.source === "database" ? "Đã lưu DB" : "Từ .env"}
          </span>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
        <span className="text-slate-500 dark:text-slate-400">Key hiện tại: </span>
        <span className="break-all font-mono font-semibold text-slate-700 dark:text-slate-200">
          {status?.masked_key ?? "Chưa cấu hình"}
        </span>
      </div>

      <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        Gemini API key mới
        <input
          type="password"
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Nhập Gemini API key mới"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Để trống nếu không muốn thay Gemini key.
      </p>
    </section>
  );
}

export function AiSettingsModal({ open, onClose }: AiSettingsModalProps) {
  const [status, setStatus] = useState<AiSettingsStatus | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [elevenLabsKeys, setElevenLabsKeys] = useState<ElevenLabsPoolKey[]>([]);
  const [defaultQuota, setDefaultQuota] = useState<ElevenLabsQuotaInfo | null>(null);
  const [keyQuotas, setKeyQuotas] = useState<Record<string, ElevenLabsQuotaInfo>>({});
  const [summary, setSummary] = useState<CheckAllSummary | null>(null);
  const [checkingDefault, setCheckingDefault] = useState(false);
  const [checkingKeyIds, setCheckingKeyIds] = useState<Record<string, boolean>>({});
  const [checkingAll, setCheckingAll] = useState(false);

  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newPoolKey, setNewPoolKey] = useState("");
  const [keyActionLoading, setKeyActionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const loading = status === null;

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      apiRequest<AiSettingsStatus>("/admin/ai-settings"),
      apiRequest<{ keys: ElevenLabsPoolKey[] }>("/admin/elevenlabs-keys"),
    ])
      .then(([settings, keyPool]) => {
        setStatus(settings);
        setElevenLabsKeys(keyPool.keys);
      })
      .catch((error) => {
        showToast(toUserMessage(error, "Không thể tải cấu hình AI."), "error");
      });
  }, [open, showToast]);

  async function handleCheckDefaultKey() {
    setCheckingDefault(true);
    try {
      const result = await apiRequest<{ quota: ElevenLabsQuotaInfo }>(
        "/admin/elevenlabs-default/check",
        { method: "POST" },
      );
      setDefaultQuota(result.quota);
    } catch (error) {
      showToast(toUserMessage(error, "Không thể kiểm tra key đang dùng."), "error");
    } finally {
      setCheckingDefault(false);
    }
  }

  async function handleCheckPoolKey(id: string) {
    if (checkingKeyIds[id]) return;
    setCheckingKeyIds((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await apiRequest<{ id: string; quota: ElevenLabsQuotaInfo }>(
        `/admin/elevenlabs-keys/${id}/check`,
        { method: "POST" },
      );
      setKeyQuotas((prev) => ({ ...prev, [id]: result.quota }));
      const target = elevenLabsKeys.find((item) => item.id === id);
      if (target?.is_primary) {
        setDefaultQuota(result.quota);
      }
    } catch (error) {
      showToast(toUserMessage(error, "Không thể kiểm tra API key này."), "error");
    } finally {
      setCheckingKeyIds((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleCheckAllKeys() {
    setCheckingAll(true);
    try {
      const result = await apiRequest<CheckAllResponse>(
        "/admin/elevenlabs-check-all",
        { method: "POST" },
      );
      setDefaultQuota(result.defaultQuota);
      setKeyQuotas(result.keyQuotas);
      setSummary(result.summary);
      showToast("Đã kiểm tra số dư toàn bộ ElevenLabs API key.", "success");
    } catch (error) {
      showToast(toUserMessage(error, "Không thể kiểm tra toàn bộ kho key."), "error");
    } finally {
      setCheckingAll(false);
    }
  }

  async function addPoolKey() {
    const label = newKeyLabel.trim();
    const apiKey = newPoolKey.trim();
    if (!label || !apiKey) {
      showToast("Hãy nhập tên gợi nhớ và ElevenLabs API key.", "error");
      return;
    }
    setKeyActionLoading(true);
    try {
      const result = await apiRequest<{
        keys: ElevenLabsPoolKey[];
        settings: AiSettingsStatus;
        addedId: string;
        quota: ElevenLabsQuotaInfo;
      }>("/admin/elevenlabs-keys", {
        method: "POST",
        body: JSON.stringify({ label, apiKey }),
      });
      setStatus(result.settings);
      setElevenLabsKeys(result.keys);
      setKeyQuotas((prev) => ({ ...prev, [result.addedId]: result.quota }));
      const addedKey = result.keys.find((item) => item.id === result.addedId);
      if (addedKey?.is_primary) {
        setDefaultQuota(result.quota);
      }
      setSummary(null);
      setNewKeyLabel("");
      setNewPoolKey("");
      showToast(
        result.quota.remaining !== null
          ? `Đã thêm "${label}" (còn ${result.quota.remaining.toLocaleString("vi-VN")} token).`
          : `Đã thêm "${label}".`,
        "success",
      );
    } catch (error) {
      showToast(toUserMessage(error, "Không thể thêm API key."), "error");
    } finally {
      setKeyActionLoading(false);
    }
  }

  function handlePoolInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!keyActionLoading && newKeyLabel.trim() && newPoolKey.trim()) {
        void addPoolKey();
      }
    }
  }

  async function activatePoolKey(key: ElevenLabsPoolKey) {
    setKeyActionLoading(true);
    try {
      const result = await apiRequest<PoolMutationResponse>(
        `/admin/elevenlabs-keys/${key.id}/activate`,
        { method: "POST" },
      );
      setStatus(result.settings);
      setElevenLabsKeys(result.keys);
      setDefaultQuota(keyQuotas[key.id] ?? null);
      setSummary(null);
      showToast(`Đã chuyển sang dùng key "${key.label}".`, "success");
    } catch (error) {
      showToast(toUserMessage(error, "Không thể đổi key đang dùng."), "error");
    } finally {
      setKeyActionLoading(false);
    }
  }

  async function togglePoolKey(key: ElevenLabsPoolKey) {
    setKeyActionLoading(true);
    try {
      const result = await apiRequest<PoolMutationResponse>(
        `/admin/elevenlabs-keys/${key.id}`,
        { method: "PATCH", body: JSON.stringify({ enabled: !key.enabled }) },
      );
      setStatus(result.settings);
      setElevenLabsKeys(result.keys);
      if (key.is_primary) {
        setDefaultQuota(null);
      }
      setSummary(null);
    } catch (error) {
      showToast(toUserMessage(error, "Không thể cập nhật API key."), "error");
    } finally {
      setKeyActionLoading(false);
    }
  }

  async function removePoolKey(key: ElevenLabsPoolKey) {
    setKeyActionLoading(true);
    try {
      const result = await apiRequest<PoolMutationResponse>(
        `/admin/elevenlabs-keys/${key.id}`,
        { method: "DELETE" },
      );
      setStatus(result.settings);
      setElevenLabsKeys(result.keys);
      if (key.is_primary) {
        setDefaultQuota(null);
      }
      setKeyQuotas((prev) => {
        const next = { ...prev };
        delete next[key.id];
        return next;
      });
      setSummary(null);
      showToast(`Đã xóa "${key.label}".`, "success");
    } catch (error) {
      showToast(toUserMessage(error, "Không thể xóa API key."), "error");
    } finally {
      setKeyActionLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const gemini = geminiApiKey.trim();
    if (!gemini) {
      showToast("Hãy nhập Gemini API key mới để lưu.", "error");
      return;
    }

    setSaving(true);
    try {
      const updated = await apiRequest<AiSettingsStatus>("/admin/ai-settings", {
        method: "PUT",
        body: JSON.stringify({ geminiApiKey: gemini }),
      });
      setStatus(updated);
      setGeminiApiKey("");
      showToast("Đã cập nhật Gemini API key. Cấu hình mới có hiệu lực ngay.", "success");
    } catch (error) {
      showToast(toUserMessage(error, "Không thể cập nhật Gemini API key."), "error");
    } finally {
      setSaving(false);
    }
  }

  const hasStandaloneDefault =
    Boolean(status?.elevenlabs.configured) &&
    !elevenLabsKeys.some((item) => item.is_primary);
  const totalPoolCount =
    (hasStandaloneDefault ? 1 : 0) + elevenLabsKeys.length;
  const summaryPercent =
    summary && summary.total_limit > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((summary.total_remaining / summary.total_limit) * 100)),
        )
      : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cấu hình API AI"
      description="Chỉ quản trị viên mới có quyền xem trạng thái, kiểm tra số dư token và đổi API key."
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-3.5 text-xs leading-5 text-indigo-800 sm:p-4 sm:text-sm sm:leading-6 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 dark:bg-slate-900 dark:text-indigo-300">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <p>
              API key được mã hóa AES-256-GCM trước khi lưu vào MySQL. Bấm{" "}
              <strong>Dùng chính</strong> trong kho để đổi key đang dùng ngay lập tức, hoặc ấn vào từng key để xem số token còn lại.
            </p>
          </div>

          {loading ? (
            <div className="grid min-h-48 place-items-center text-sm text-slate-500">
              Đang tải cấu hình…
            </div>
          ) : (
            <>
              {/* TỔNG QUAN QUOTA TOÀN KHO ELEVENLABS */}
              <section className="rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/90 via-white to-cyan-50/90 p-4 dark:border-indigo-900/70 dark:from-indigo-950/40 dark:via-slate-900 dark:to-cyan-950/30">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
                      <Wallet className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Tổng token ElevenLabs khả dụng
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {summary
                          ? `Gộp từ ${summary.unique_account_count} tài khoản riêng biệt (${summary.active_key_count} key đang bật)`
                          : `Hiện có ${totalPoolCount} key đã lưu · Bấm kiểm tra tất cả để tính tổng`}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    loading={checkingAll}
                    disabled={totalPoolCount === 0}
                    onClick={() => void handleCheckAllKeys()}
                    className="w-full border-indigo-200 text-indigo-700 sm:w-auto dark:border-indigo-800 dark:text-indigo-300"
                  >
                    {!checkingAll && <RefreshCw className="h-4 w-4" />}
                    Kiểm tra tất cả
                  </Button>
                </div>

                {summary && (
                  <div className="mt-3.5 space-y-2 border-t border-indigo-100 pt-3 dark:border-indigo-900/60">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Tổng còn dùng được:{" "}
                        <strong className="text-base font-extrabold text-indigo-700 dark:text-indigo-300">
                          {summary.total_remaining.toLocaleString("vi-VN")}
                        </strong>{" "}
                        / {summary.total_limit.toLocaleString("vi-VN")} token ({summaryPercent}%)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Đã dùng: {summary.total_used.toLocaleString("vi-VN")}
                      </span>
                    </div>
                    {summary.total_limit > 0 && (
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 transition-all duration-300"
                          style={{ width: `${summaryPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* PHẦN 1: KEY ĐANG DÙNG (CHỈ HIỂN THỊ TRẠNG THÁI & KIỂM TRA SỐ DƯ, ĐÃ XÓA Ô NHẬP THỪA) */}
              <ActiveElevenLabsCard
                status={status?.elevenlabs}
                onCheckQuota={() => void handleCheckDefaultKey()}
                checkingQuota={checkingDefault}
                quota={defaultQuota}
              />

              {/* PHẦN 2: KHO NHIỀU KEY TỪ CÁC TÀI KHOẢN KHÁC NHAU (CÓ SCROLL) */}
              <section className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 dark:border-cyan-900 dark:bg-cyan-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      Kho ElevenLabs API key ({elevenLabsKeys.length})
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Thêm key từ nhiều tài khoản khác nhau. Ấn vào dòng để kiểm tra token hoặc bấm{" "}
                      <strong>Dùng chính</strong> để thay thế key đang dùng.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-[0.8fr_1.2fr_auto]">
                  <input
                    value={newKeyLabel}
                    onChange={(event) => setNewKeyLabel(event.target.value)}
                    onKeyDown={handlePoolInputKeyDown}
                    placeholder="Tên gợi nhớ (VD: Acc Gmail 2)"
                    maxLength={80}
                    className="min-h-11 rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-cyan-900 dark:bg-slate-900"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPoolKey}
                    onChange={(event) => setNewPoolKey(event.target.value)}
                    onKeyDown={handlePoolInputKeyDown}
                    placeholder="Dán ElevenLabs API key (sk_...)"
                    className="min-h-11 rounded-xl border border-cyan-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-cyan-500 dark:border-cyan-900 dark:bg-slate-900"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void addPoolKey()}
                    loading={keyActionLoading}
                    disabled={!newKeyLabel.trim() || !newPoolKey.trim()}
                  >
                    <Plus className="h-4 w-4" /> Thêm key
                  </Button>
                </div>

                <div className="mt-4 max-h-72 space-y-2.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable] sm:max-h-80">
                  {elevenLabsKeys.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-cyan-200 p-4 text-center text-xs text-slate-500 dark:border-cyan-900">
                      Chưa có key nào trong kho. Hãy thêm key ở trên để sử dụng và chuyển đổi nhanh.
                    </p>
                  ) : (
                    elevenLabsKeys.map((key) => {
                      const quota = keyQuotas[key.id];
                      const isChecking = Boolean(checkingKeyIds[key.id]);
                      return (
                        <div
                          key={key.id}
                          onClick={() => void handleCheckPoolKey(key.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              void handleCheckPoolKey(key.id);
                            }
                          }}
                          title="Ấn vào để kiểm tra số token còn lại của key này"
                          className={`cursor-pointer rounded-xl border p-3.5 transition hover:shadow-xs focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/20 ${
                            key.is_primary
                              ? "border-indigo-300 bg-white ring-2 ring-indigo-500/15 dark:border-indigo-700 dark:bg-slate-900"
                              : "border-cyan-100 bg-white hover:border-cyan-300 dark:border-cyan-900 dark:bg-slate-900 dark:hover:border-cyan-700"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-800 dark:text-slate-100">
                                  #{key.priority} · {key.label}
                                </span>
                                {key.is_primary && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                    <Sparkles className="h-3 w-3" />
                                    Đang dùng chính
                                  </span>
                                )}
                                {!key.enabled && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    Đã tắt
                                  </span>
                                )}
                                {quota && (
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      quota.valid
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                        : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                    }`}
                                  >
                                    {quota.valid ? "Hoạt động" : "Có lỗi"}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 break-all font-mono text-xs text-slate-500">
                                {key.masked_key}
                              </p>
                              {!quota && !isChecking && (
                                <p className="mt-1 text-[11px] font-medium text-cyan-700 dark:text-cyan-400">
                                  Ấn vào dòng này hoặc nút Kiểm tra để xem số token còn lại
                                </p>
                              )}
                            </div>

                            <div
                              className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {!key.is_primary && (
                                <button
                                  type="button"
                                  disabled={keyActionLoading}
                                  onClick={() => void activatePoolKey(key)}
                                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
                                  title="Đặt key này làm key đang dùng chính"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Dùng chính
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={isChecking}
                                onClick={() => void handleCheckPoolKey(key.id)}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-60 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200 dark:hover:bg-cyan-900"
                              >
                                {isChecking ? (
                                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Activity className="h-3.5 w-3.5" />
                                )}
                                {quota ? "Kiểm tra lại" : "Kiểm tra"}
                              </button>

                              <button
                                type="button"
                                disabled={keyActionLoading}
                                onClick={() => void togglePoolKey(key)}
                                className="inline-flex min-h-9 items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                {key.enabled ? "Tắt" : "Bật"}
                              </button>

                              <button
                                type="button"
                                disabled={keyActionLoading}
                                onClick={() => void removePoolKey(key)}
                                className="grid h-9 w-9 place-items-center rounded-xl border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950"
                                aria-label={`Xóa ${key.label}`}
                                title="Xóa key này"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {quota && (
                            <div onClick={(event) => event.stopPropagation()}>
                              <QuotaDetailsPanel quota={quota} />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* GOOGLE GEMINI */}
              <GeminiProviderCard
                status={status?.gemini}
                value={geminiApiKey}
                onChange={setGeminiApiKey}
              />
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 dark:border-slate-800 dark:bg-slate-950/40">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Đóng
          </Button>
          <Button
            type="submit"
            loading={saving}
            disabled={loading || !geminiApiKey.trim()}
          >
            <KeyRound className="h-4 w-4" />
            Lưu Gemini API key
          </Button>
        </div>
      </form>
    </Modal>
  );
}
