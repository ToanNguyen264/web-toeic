import {
  BookOpenText,
  FileAudio,
  Headphones,
  Languages,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
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
import {
  generateToeicExample,
  generateToeicExampleAudio,
  generateVocabularyAudio,
  type ListeningLessonSegment,
} from "../../services/tts.service";
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
  exampleEnglish?: string;
  exampleAnnotatedEnglish?: string;
  exampleVietnamese?: string;
  exampleAudio?: string;
};

type VocabularyFormModalProps = {
  vocabulary: Vocabulary | null;
  loading: boolean;
  onSubmit: (values: VocabularyFormValues) => Promise<void>;
  onClose: () => void;
};

function hasSpeakableText(value: string) {
  return /[\p{L}\p{N}]/u.test(value);
}

function removeVietnameseAnnotations(value: string) {
  return cleanText(value.replace(/\([^()]+\)/g, " "));
}

function buildListeningLessonSegments(
  english: string,
  annotatedEnglish: string,
): ListeningLessonSegment[] {
  const segments: ListeningLessonSegment[] = [{ language: "en", text: english }];
  const annotationPattern = /\(([^()]+)\)/g;
  let cursor = 0;
  let annotation: RegExpExecArray | null;

  while ((annotation = annotationPattern.exec(annotatedEnglish)) !== null) {
    const englishPart = cleanText(annotatedEnglish.slice(cursor, annotation.index));
    if (hasSpeakableText(englishPart)) {
      segments.push({ language: "en", text: englishPart });
    }
    const vietnameseMeaning = cleanText(annotation[1]);
    if (hasSpeakableText(vietnameseMeaning)) {
      segments.push({ language: "vi", text: `nghĩa là ${vietnameseMeaning}` });
    }
    cursor = annotation.index + annotation[0].length;
  }

  const finalEnglishPart = cleanText(annotatedEnglish.slice(cursor));
  if (hasSpeakableText(finalEnglishPart)) {
    segments.push({ language: "en", text: finalEnglishPart });
  }
  segments.push({ language: "en", text: english });
  return segments;
}

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
  const [exampleEnglish, setExampleEnglish] = useState(vocabulary?.example_english ?? "");
  const [exampleAnnotatedEnglish, setExampleAnnotatedEnglish] = useState(
    vocabulary?.example_annotated_english ?? "",
  );
  const [exampleVietnamese, setExampleVietnamese] = useState(
    vocabulary?.example_vietnamese ?? "",
  );
  const [exampleAudioFile, setExampleAudioFile] = useState<File | null>(null);
  const [examplePreviewUrl, setExamplePreviewUrl] = useState<string | null>(null);
  const [removeCurrentExampleAudio, setRemoveCurrentExampleAudio] = useState(false);
  const [generatingExample, setGeneratingExample] = useState(false);
  const [generatingExampleAudio, setGeneratingExampleAudio] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = loading || generatingAudio || generatingExample || generatingExampleAudio;

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  useEffect(
    () => () => {
      if (examplePreviewUrl) URL.revokeObjectURL(examplePreviewUrl);
    },
    [examplePreviewUrl],
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

  function setExampleFile(file: File | null) {
    if (examplePreviewUrl) URL.revokeObjectURL(examplePreviewUrl);
    const audioError = validateAudioFile(file);
    setErrors((current) => ({ ...current, exampleAudio: audioError ?? undefined }));
    if (audioError || !file) {
      setExampleAudioFile(null);
      setExamplePreviewUrl(null);
      return;
    }
    setExampleAudioFile(file);
    setExamplePreviewUrl(URL.createObjectURL(file));
    setRemoveCurrentExampleAudio(false);
  }

  function invalidateExampleAudio() {
    if (exampleAudioFile) setExampleFile(null);
    if (vocabulary?.example_audio_path) setRemoveCurrentExampleAudio(true);
  }

  function handleExampleEnglishChange(value: string) {
    if (value !== exampleEnglish) invalidateExampleAudio();
    setExampleEnglish(value);
  }

  function handleAnnotatedEnglishChange(value: string) {
    if (value !== exampleAnnotatedEnglish) invalidateExampleAudio();
    setExampleAnnotatedEnglish(value);
  }

  function handleExampleVietnameseChange(value: string) {
    if (value !== exampleVietnamese) invalidateExampleAudio();
    setExampleVietnamese(value);
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

  async function handleGenerateExample() {
    const word = cleanText(englishWord);
    const meaning = cleanText(vietnameseMeaning);
    if (!word || !meaning) {
      setErrors((current) => ({
        ...current,
        englishWord: word ? undefined : "Vui lòng nhập từ tiếng Anh trước.",
        vietnameseMeaning: meaning ? undefined : "Vui lòng nhập nghĩa tiếng Việt trước.",
      }));
      return;
    }

    setGeneratingExample(true);
    setErrors((current) => ({
      ...current,
      englishWord: undefined,
      vietnameseMeaning: undefined,
      exampleEnglish: undefined,
      exampleAnnotatedEnglish: undefined,
      exampleVietnamese: undefined,
    }));
    try {
      const example = await generateToeicExample(word, meaning);
      invalidateExampleAudio();
      setExampleEnglish(example.english);
      setExampleAnnotatedEnglish(example.annotatedEnglish);
      setExampleVietnamese(example.vietnamese);
    } catch (error) {
      setErrors((current) => ({
        ...current,
        exampleEnglish: toUserMessage(
          error,
          "Không thể tạo câu ví dụ TOEIC. Vui lòng thử lại.",
        ),
      }));
    } finally {
      setGeneratingExample(false);
    }
  }

  async function handleGenerateExampleAudio() {
    const annotatedEnglish = cleanText(exampleAnnotatedEnglish);
    const english =
      cleanText(exampleEnglish) || removeVietnameseAnnotations(annotatedEnglish);
    if (!english || !annotatedEnglish) {
      setErrors((current) => ({
        ...current,
        exampleEnglish: english ? undefined : "Vui lòng nhập câu ví dụ tiếng Anh.",
        exampleAnnotatedEnglish: annotatedEnglish
          ? undefined
          : "Vui lòng tạo câu tiếng Anh có chú thích từ khó.",
      }));
      return;
    }

    setGeneratingExampleAudio(true);
    setErrors((current) => ({ ...current, exampleAudio: undefined }));
    try {
      if (!cleanText(exampleEnglish)) setExampleEnglish(english);
      const blob = await generateToeicExampleAudio(
        buildListeningLessonSegments(english, annotatedEnglish),
      );
      const safeName =
        cleanText(englishWord)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "toeic-example";
      setExampleFile(
        new File([blob], `${safeName}-example.mp3`, {
          type: blob.type || "audio/mpeg",
        }),
      );
    } catch (error) {
      setErrors((current) => ({
        ...current,
        exampleAudio: toUserMessage(error, "Không thể tạo audio ví dụ."),
      }));
    } finally {
      setGeneratingExampleAudio(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fieldErrors = validateVocabularyFields(
      englishWord,
      vietnameseMeaning,
      exampleEnglish,
      exampleAnnotatedEnglish,
      exampleVietnamese,
    );
    const audioError = validateAudioFile(audioFile);
    const exampleAudioError = validateAudioFile(exampleAudioFile);
    const nextErrors: FormErrors = {
      ...fieldErrors,
      audio: audioError ?? undefined,
      exampleAudio: exampleAudioError ?? undefined,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    await onSubmit({
      englishWord: cleanText(englishWord),
      vietnameseMeaning: cleanText(vietnameseMeaning),
      audioFile,
      removeCurrentAudio,
      exampleEnglish: cleanText(exampleEnglish),
      exampleAnnotatedEnglish: cleanText(exampleAnnotatedEnglish),
      exampleVietnamese: cleanText(exampleVietnamese),
      exampleAudioFile,
      removeCurrentExampleAudio,
    });
  }

  return (
    <Modal
      open
      title={vocabulary ? "Chỉnh sửa từ vựng" : "Thêm từ mới"}
      description="Lưu từ, nghĩa, câu ví dụ TOEIC và audio để luyện nghe."
      onClose={() => {
        if (!busy) onClose();
      }}
      size="xl"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)_minmax(0,0.85fr)] lg:items-start">
          <section className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
                <Languages className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  Thông tin từ vựng
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">Nhập từ và nghĩa cần ghi nhớ.</p>
              </div>
            </div>

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
                rows={6}
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
          </section>

          <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/20 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-violet-600 shadow-sm dark:bg-slate-900 dark:text-violet-300">
                  <BookOpenText className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    Ví dụ theo chủ đề TOEIC
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Chèn nghĩa Việt sau mọi từ/cụm từ từ A2 trở lên hoặc dễ gây khó.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="shrink-0 border-violet-200 text-violet-700 dark:border-violet-800 dark:text-violet-300"
                onClick={handleGenerateExample}
                loading={generatingExample}
                disabled={busy || !cleanText(englishWord) || !cleanText(vietnameseMeaning)}
              >
                {!generatingExample && <WandSparkles className="h-4 w-4" />}
                {exampleEnglish ? "Tạo câu khác" : "Tạo bằng Gemini"}
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="example-english"
                  className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Câu tiếng Anh
                </label>
                <textarea
                  id="example-english"
                  rows={3}
                  maxLength={500}
                  value={exampleEnglish}
                  onChange={(event) => handleExampleEnglishChange(event.target.value)}
                  placeholder="Gemini sẽ tạo một câu trong bối cảnh TOEIC…"
                  aria-invalid={Boolean(errors.exampleEnglish)}
                  className={`w-full resize-none rounded-xl border bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 dark:bg-slate-900 dark:text-white ${
                    errors.exampleEnglish
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10"
                      : "border-violet-100 focus:border-violet-500 focus:ring-violet-500/10 dark:border-violet-900"
                  }`}
                />
                {errors.exampleEnglish && (
                  <p className="mt-1.5 text-xs font-medium text-rose-600">
                    {errors.exampleEnglish}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="example-vietnamese"
                  className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Nghĩa tiếng Việt
                </label>
                <textarea
                  id="example-vietnamese"
                  rows={3}
                  maxLength={1000}
                  value={exampleVietnamese}
                  onChange={(event) => handleExampleVietnameseChange(event.target.value)}
                  placeholder="Bản dịch tiếng Việt của câu ví dụ…"
                  aria-invalid={Boolean(errors.exampleVietnamese)}
                  className={`w-full resize-none rounded-xl border bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 dark:bg-slate-900 dark:text-white ${
                    errors.exampleVietnamese
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10"
                      : "border-violet-100 focus:border-violet-500 focus:ring-violet-500/10 dark:border-violet-900"
                  }`}
                />
                {errors.exampleVietnamese && (
                  <p className="mt-1.5 text-xs font-medium text-rose-600">
                    {errors.exampleVietnamese}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="example-annotated-english"
                  className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Câu tiếng Anh có chú thích từ khó
                </label>
                <textarea
                  id="example-annotated-english"
                  rows={3}
                  maxLength={1000}
                  value={exampleAnnotatedEnglish}
                  onChange={(event) => handleAnnotatedEnglishChange(event.target.value)}
                  placeholder="Ví dụ: The manager will attend (tham dự) the conference (hội nghị)."
                  aria-invalid={Boolean(errors.exampleAnnotatedEnglish)}
                  className={`w-full resize-none rounded-xl border bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 dark:bg-slate-900 dark:text-white ${
                    errors.exampleAnnotatedEnglish
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10"
                      : "border-violet-100 focus:border-violet-500 focus:ring-violet-500/10 dark:border-violet-900"
                  }`}
                />
                {errors.exampleAnnotatedEnglish && (
                  <p className="mt-1.5 text-xs font-medium text-rose-600">
                    {errors.exampleAnnotatedEnglish}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="secondary"
                className="w-full border-cyan-200 text-cyan-700 dark:border-cyan-900 dark:text-cyan-300"
                onClick={handleGenerateExampleAudio}
                loading={generatingExampleAudio}
                disabled={busy || !cleanText(exampleAnnotatedEnglish)}
              >
                {!generatingExampleAudio && <Languages className="h-4 w-4" />}
                {exampleAudioFile ? "Tạo lại audio câu chú thích" : "Tạo audio câu chú thích"}
              </Button>

              {exampleAudioFile && examplePreviewUrl && (
                <div className="rounded-xl border border-cyan-100 bg-white p-3 dark:border-cyan-900 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                        {exampleAudioFile.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatFileSize(exampleAudioFile.size)} · Sẵn sàng lưu
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExampleFile(null)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                      aria-label="Bỏ audio ví dụ vừa tạo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <audio
                    className="mt-3 h-10 w-full"
                    controls
                    preload="metadata"
                    src={examplePreviewUrl}
                  >
                    Trình duyệt không hỗ trợ phát audio.
                  </audio>
                </div>
              )}

              {errors.exampleAudio && (
                <p className="text-xs font-medium text-rose-600">{errors.exampleAudio}</p>
              )}

              {vocabulary?.example_audio_path && !exampleAudioFile && (
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-violet-100 bg-white p-3 text-sm text-slate-600 dark:border-violet-900 dark:bg-slate-900 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={removeCurrentExampleAudio}
                    onChange={(event) => setRemoveCurrentExampleAudio(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-rose-600"
                  />
                  <Headphones className="h-4 w-4 text-violet-500" />
                  <span className="min-w-0 flex-1 truncate">
                    Xóa audio ví dụ hiện tại
                  </span>
                </label>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
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
                className={`group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-5 text-center transition ${
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
              disabled={busy || !cleanText(englishWord)}
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
          </section>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button type="submit" loading={loading} disabled={busy && !loading}>
            {vocabulary ? "Lưu thay đổi" : "Thêm từ vựng"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
