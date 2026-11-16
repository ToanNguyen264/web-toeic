import { FileAudio, Headphones, UploadCloud, WandSparkles, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type {
  Vocabulary,
  VocabularyFormValues,
} from "../../types/vocabulary";
import { generateVocabularyAudio } from "../../services/tts.service";
import { toUserMessage } from "../../utils/errors";
import {
  cleanText,
  formatFileSize,
  validateAudioFile,
  validateVocabularyFields,
} from "../../utils/validation";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { TextField } from "../ui/TextField";

type FormErrors = {
  englishWord?: string;
  vietnameseMeaning?: string;
  audio?: string;
};

type VocabularyFormModalProps = {
  vocabulary: Vocabulary | null;
  loading: boolean;
  onSubmit: (values: VocabularyFormValues) => Promise<void>;
  onClose: () => void;
};

export function VocabularyFormModal({
  vocabulary,
  loading,
  onSubmit,
  onClose,
}: VocabularyFormModalProps) {
  const [englishWord, setEnglishWord] = useState(vocabulary?.english_word ?? "");
  const [vietnameseMeaning, setVietnameseMeaning] = useState(
    vocabulary?.vietnamese_meaning ?? "",
  );
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeCurrentAudio, setRemoveCurrentAudio] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function setFile(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const audioError = validateAudioFile(file);
    setErrors((current) => ({ ...current, audio: audioError ?? undefined }));
    if (audioError || !file) {
      setAudioFile(null);
      setPreviewUrl(null);
      return;
    }
    setAudioFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveCurrentAudio(false);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  async function handleGenerateAudio() {
    const text = cleanText(englishWord);
    if (!text) {
      setErrors((current) => ({
        ...current,
        englishWord: "Vui lòng nhập từ tiếng Anh trước khi tạo audio.",
      }));
      return;
    }

    setGeneratingAudio(true);
    setErrors((current) => ({ ...current, englishWord: undefined, audio: undefined }));
    try {
      const blob = await generateVocabularyAudio(text);
      const safeName =
        text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "pronunciation";
      setFile(
        new File([blob], `${safeName}.mp3`, {
          type: blob.type || "audio/mpeg",
        }),
      );
    } catch (error) {
      setErrors((current) => ({
        ...current,
        audio: toUserMessage(error, "Không thể tạo audio. Vui lòng thử lại."),
      }));
    } finally {
      setGeneratingAudio(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fieldErrors = validateVocabularyFields(englishWord, vietnameseMeaning);
    const audioError = validateAudioFile(audioFile);
    const nextErrors: FormErrors = {
      ...fieldErrors,
      audio: audioError ?? undefined,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    await onSubmit({
      englishWord: cleanText(englishWord),
      vietnameseMeaning: cleanText(vietnameseMeaning),
      audioFile,
      removeCurrentAudio,
    });
  }

  return (
    <Modal
      open
      title={vocabulary ? "Chỉnh sửa từ vựng" : "Thêm từ mới"}
      description="Lưu từ, nghĩa và file phát âm để nghe lại bất cứ lúc nào."
      onClose={() => {
        if (!loading && !generatingAudio) onClose();
      }}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-5 p-5 sm:p-6">
          <TextField
            id="english-word"
            label="Từ tiếng Anh"
            placeholder="Ví dụ: opportunity"
            value={englishWord}
            onChange={(event) => setEnglishWord(event.target.value)}
            error={errors.englishWord}
            maxLength={150}
            autoFocus
          />

          <div>
            <label
              htmlFor="vietnamese-meaning"
              className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Nghĩa tiếng Việt
            </label>
            <textarea
              id="vietnamese-meaning"
              rows={4}
              maxLength={1000}
              value={vietnameseMeaning}
              onChange={(event) => setVietnameseMeaning(event.target.value)}
              placeholder="Ví dụ: cơ hội"
              aria-invalid={Boolean(errors.vietnameseMeaning)}
              className={`w-full resize-none rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 dark:bg-slate-900 dark:text-white ${
                errors.vietnameseMeaning
                  ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10"
                  : "border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/10 dark:border-slate-700"
              }`}
            />
            {errors.vietnameseMeaning && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">
                {errors.vietnameseMeaning}
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Audio phát âm <span className="font-normal text-slate-400">(không bắt buộc)</span>
              </label>
              <span className="text-xs text-slate-400">Tối đa 5 MB</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/ogg,audio/webm"
              className="sr-only"
              onChange={handleFileChange}
            />

            {!audioFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-7 text-center transition ${
                  errors.audio
                    ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"
                    : "border-slate-200 bg-slate-50/70 hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30"
                }`}
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-indigo-600 shadow-sm transition group-hover:-translate-y-0.5 dark:bg-slate-900 dark:text-indigo-300">
                  <UploadCloud className="h-6 w-6" />
                </span>
                <span className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Chọn file audio
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  MP3, M4A, WAV, OGG hoặc WebM
                </span>
              </button>
            ) : (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
                    <FileAudio className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                      {audioFile.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatFileSize(audioFile.size)} · Sẵn sàng tải lên
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-white hover:text-rose-600 dark:hover:bg-slate-900"
                    aria-label="Bỏ file đã chọn"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {previewUrl && (
                  <audio
                    className="mt-4 h-10 w-full"
                    controls
                    preload="metadata"
                    src={previewUrl}
                  >
                    Trình duyệt không hỗ trợ phát audio.
                  </audio>
                )}
              </div>
            )}
            {errors.audio && (
              <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.audio}</p>
            )}

            <Button
              type="button"
              variant="secondary"
              className="mt-3 w-full border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300"
              onClick={handleGenerateAudio}
              loading={generatingAudio}
              disabled={loading || !cleanText(englishWord)}
            >
              {!generatingAudio && <WandSparkles className="h-4 w-4" />}
              {audioFile ? "Tạo lại audio bằng AI" : "Tạo audio bằng AI"}
            </Button>
            <p className="mt-1.5 text-center text-xs text-slate-400">
              Tạo phát âm tiếng Anh bằng giọng AI đã cấu hình, sau đó lưu cùng từ vựng.
            </p>

            {vocabulary?.audio_path && !audioFile && (
              <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={removeCurrentAudio}
                  onChange={(event) => setRemoveCurrentAudio(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-rose-600"
                />
                <Headphones className="h-4 w-4 text-slate-400" />
                <span className="min-w-0 flex-1 truncate">
                  Xóa audio hiện tại: {vocabulary.audio_name || "audio"}
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading || generatingAudio}>
            Hủy
          </Button>
          <Button type="submit" loading={loading} disabled={generatingAudio}>
            {vocabulary ? "Lưu thay đổi" : "Thêm từ vựng"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
