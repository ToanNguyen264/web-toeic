import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const loading = status === null;

  useEffect(() => {
    if (!open) return;
    void apiRequest<AiSettingsStatus>("/admin/ai-settings")
      .then(setStatus)
      .catch((error) => {
        showToast(toUserMessage(error, "Không thể tải cấu hình AI."), "error");
      });
  }, [open, showToast]);

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
                description="Dùng để tạo audio từ vựng và audio ví dụ song ngữ."
                status={status?.elevenlabs}
                value={elevenlabsApiKey}
                onChange={setElevenlabsApiKey}
                placeholder="Nhập ElevenLabs API key mới"
              />
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
