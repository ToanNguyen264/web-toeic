import { CheckCircle2, KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import { useToast } from "../../hooks/useToast";
import { toUserMessage } from "../../utils/errors";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

type ProviderStatus = {
  configured: boolean;
  masked_key: string | null;
  source: "database" | "environment";
  updated_at: string | null;
};

type AiSettingsStatus = {
  elevenlabs: ProviderStatus;
  gemini: ProviderStatus;
};

type ElevenLabsKeyStatus = {
  id: string;
  label: string;
  enabled: boolean;
  priority: number;
  masked_key: string;
  valid: boolean;
  workspace_id?: string | null;
  tier?: string | null;
  used?: number | null;
  limit?: number | null;
  remaining?: number | null;
  error?: string | null;
};

type AiSettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

function ProviderCard({
  title,
  description,
  status,
  value,
  onChange,
  placeholder,
}: {
  title: string;
  description: string;
  status?: ProviderStatus;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
        {status?.configured && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> Đã cấu hình
          </span>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
        <span className="text-slate-500 dark:text-slate-400">Key hiện tại: </span>
        <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
          {status?.masked_key ?? "Chưa cấu hình"}
        </span>
      </div>

      <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        API key mới
        <input
          type="password"
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </label>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Để trống nếu không muốn thay key này.
      </p>
    </section>
  );
}

export function AiSettingsModal({ open, onClose }: AiSettingsModalProps) {
  const [status, setStatus] = useState<AiSettingsStatus | null>(null);
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [elevenLabsKeys, setElevenLabsKeys] = useState<ElevenLabsKeyStatus[]>([]);
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
      apiRequest<{ keys: ElevenLabsKeyStatus[] }>("/admin/elevenlabs-keys"),
    ])
      .then(([settings, keyPool]) => {
        setStatus(settings);
        setElevenLabsKeys(keyPool.keys);
      })
      .catch((error) => {
        showToast(toUserMessage(error, "Không thể tải cấu hình AI."), "error");
      });
  }, [open, showToast]);

  async function addPoolKey() {
    const label = newKeyLabel.trim();
    const apiKey = newPoolKey.trim();
    if (!label || !apiKey) {
      showToast("Hãy nhập tên và ElevenLabs API key.", "error");
      return;
    }
    setKeyActionLoading(true);
    try {
      const result = await apiRequest<{ keys: ElevenLabsKeyStatus[] }>(
        "/admin/elevenlabs-keys",
        { method: "POST", body: JSON.stringify({ label, apiKey }) },
      );
      setElevenLabsKeys(result.keys);
      setNewKeyLabel("");
      setNewPoolKey("");
      showToast("Đã thêm và kiểm tra ElevenLabs API key.", "success");
    } catch (error) {
      showToast(toUserMessage(error, "Không thể thêm API key."), "error");
    } finally {
      setKeyActionLoading(false);
    }
  }

  async function togglePoolKey(key: ElevenLabsKeyStatus) {
    setKeyActionLoading(true);
    try {
      const result = await apiRequest<{ keys: ElevenLabsKeyStatus[] }>(
        `/admin/elevenlabs-keys/${key.id}`,
        { method: "PATCH", body: JSON.stringify({ enabled: !key.enabled }) },
      );
      setElevenLabsKeys(result.keys);
    } catch (error) {
      showToast(toUserMessage(error, "Không thể cập nhật API key."), "error");
    } finally {
      setKeyActionLoading(false);
    }
  }

  async function removePoolKey(key: ElevenLabsKeyStatus) {
    setKeyActionLoading(true);
    try {
      await apiRequest<void>(`/admin/elevenlabs-keys/${key.id}`, { method: "DELETE" });
      setElevenLabsKeys((current) => current.filter((item) => item.id !== key.id));
      showToast(`Đã xóa ${key.label}.`, "success");
    } catch (error) {
      showToast(toUserMessage(error, "Không thể xóa API key."), "error");
    } finally {
      setKeyActionLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const elevenlabs = elevenlabsApiKey.trim();
    const gemini = geminiApiKey.trim();
    if (!elevenlabs && !gemini) {
      showToast("Hãy nhập ít nhất một API key mới.", "error");
      return;
    }

    setSaving(true);
    try {
      const updated = await apiRequest<AiSettingsStatus>("/admin/ai-settings", {
        method: "PUT",
        body: JSON.stringify({
          ...(elevenlabs ? { elevenlabsApiKey: elevenlabs } : {}),
          ...(gemini ? { geminiApiKey: gemini } : {}),
        }),
      });
      setStatus(updated);
      setElevenlabsApiKey("");
      setGeminiApiKey("");
      showToast("Đã cập nhật API key. Cấu hình mới có hiệu lực ngay.", "success");
    } catch (error) {
      showToast(toUserMessage(error, "Không thể cập nhật API key."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cấu hình API AI"
      description="Chỉ quản trị viên mới có quyền xem trạng thái và thay API key."
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 dark:bg-slate-900 dark:text-indigo-300">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <p className="leading-6">
              API key được mã hóa trước khi lưu vào MySQL và không được gửi lại đầy đủ cho trình duyệt.
            </p>
          </div>

          {loading ? (
            <div className="grid min-h-48 place-items-center text-sm text-slate-500">
              Đang tải cấu hình…
            </div>
          ) : (
            <>
              <ProviderCard
                title="ElevenLabs"
                description="Key mặc định hiện tại; được thử trước, sau đó mới chuyển sang các key trong kho."
                status={status?.elevenlabs}
                value={elevenlabsApiKey}
                onChange={setElevenlabsApiKey}
                placeholder="Nhập ElevenLabs API key mới"
              />
              <section className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 dark:border-cyan-900 dark:bg-cyan-950/20">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Kho ElevenLabs API key
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Hệ thống dùng theo thứ tự và tự chuyển khi key bị từ chối hoặc hết quota.
                    Các key cùng workspace vẫn dùng chung credits.
                  </p>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-[0.7fr_1.3fr_auto]">
                  <input
                    value={newKeyLabel}
                    onChange={(event) => setNewKeyLabel(event.target.value)}
                    placeholder="Tên key, ví dụ: Workspace 2"
                    maxLength={80}
                    className="rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-cyan-900 dark:bg-slate-900"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPoolKey}
                    onChange={(event) => setNewPoolKey(event.target.value)}
                    placeholder="ElevenLabs API key"
                    className="rounded-xl border border-cyan-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-cyan-500 dark:border-cyan-900 dark:bg-slate-900"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void addPoolKey()}
                    loading={keyActionLoading}
                    disabled={!newKeyLabel.trim() || !newPoolKey.trim()}
                  >
                    <Plus className="h-4 w-4" /> Thêm
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  {elevenLabsKeys.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-cyan-200 p-3 text-center text-xs text-slate-500 dark:border-cyan-900">
                      Chưa có key trong kho. Key mặc định phía trên vẫn hoạt động.
                    </p>
                  ) : (
                    elevenLabsKeys.map((key) => (
                      <div
                        key={key.id}
                        className="rounded-xl border border-cyan-100 bg-white p-3 dark:border-cyan-900 dark:bg-slate-900"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-800 dark:text-slate-100">
                                {key.priority}. {key.label}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                key.valid
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                              }`}>
                                {key.valid ? "Hợp lệ" : "Có lỗi"}
                              </span>
                              {!key.enabled && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                                  Đã tắt
                                </span>
                              )}
                            </div>
                            <p className="mt-1 break-all font-mono text-xs text-slate-500">
                              {key.masked_key}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Workspace: {key.workspace_id ?? "Không xác định"} · Gói: {key.tier ?? "—"}
                              {key.remaining !== null && key.remaining !== undefined
                                ? ` · Còn ${key.remaining.toLocaleString()} credits`
                                : ""}
                            </p>
                            {key.error && <p className="mt-1 text-xs text-rose-600">{key.error}</p>}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={keyActionLoading}
                              onClick={() => void togglePoolKey(key)}
                            >
                              {key.enabled ? "Tắt" : "Bật"}
                            </Button>
                            <button
                              type="button"
                              disabled={keyActionLoading}
                              onClick={() => void removePoolKey(key)}
                              className="grid h-11 w-11 place-items-center rounded-xl border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950"
                              aria-label={`Xóa ${key.label}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
              <ProviderCard
                title="Google Gemini"
                description="Dùng để tạo câu ví dụ theo ngữ cảnh TOEIC."
                status={status?.gemini}
                value={geminiApiKey}
                onChange={setGeminiApiKey}
                placeholder="Nhập Gemini API key mới"
              />
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Đóng
          </Button>
          <Button
            type="submit"
            loading={saving}
            disabled={loading || (!elevenlabsApiKey.trim() && !geminiApiKey.trim())}
          >
            <KeyRound className="h-4 w-4" />
            Lưu API key
          </Button>
        </div>
      </form>
    </Modal>
  );
}
