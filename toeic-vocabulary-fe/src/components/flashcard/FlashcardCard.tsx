import {
  AlertCircle,
  BookOpenText,
  ChevronDown,
  ChevronUp,
  Clock,
  Headphones,
  LoaderCircle,
  Pause,
  Play,
  RotateCw,
  Sparkles,
} from "lucide-react";
import type { MasteryLevel, Vocabulary } from "../../types/vocabulary";

type FlashcardCardProps = {
  card: Vocabulary;
  flipped: boolean;
  onFlip: () => void;
  exampleOpen: boolean;
  onToggleExample: () => void;
  playingKind: "word" | "example" | null;
  loadingKind: "word" | "example" | null;
  failedKind: "word" | "example" | null;
  onPlayAudio: (kind: "word" | "example") => void;
  sessionGrade?: MasteryLevel;
};

const MASTERY_BADGES: Record<
  MasteryLevel,
  { label: string; className: string }
> = {
  unlearned: {
    label: "Chưa thuộc",
    className:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/70 dark:text-cyan-300",
  },
  learning: {
    label: "Thuộc sơ sơ",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/70 dark:text-violet-300",
  },
  mastered: {
    label: "Thuộc kĩ",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/70 dark:text-amber-300",
  },
};

function formatReviewBadge(card: Vocabulary) {
  if (!card.last_reviewed_at || card.review_count === 0) {
    return {
      text: "Chưa ôn lần nào",
      isNew: true,
    };
  }
  const formattedDate = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
  }).format(new Date(card.last_reviewed_at));
  return {
    text: `Đã ôn ${card.review_count} lần · ${formattedDate}`,
    isNew: false,
  };
}

export function FlashcardCard({
  card,
  flipped,
  onFlip,
  exampleOpen,
  onToggleExample,
  playingKind,
  loadingKind,
  failedKind,
  onPlayAudio,
  sessionGrade,
}: FlashcardCardProps) {
  const badge = MASTERY_BADGES[card.mastery_level];
  const reviewInfo = formatReviewBadge(card);
  const wordPlaying = playingKind === "word";
  const wordLoading = loadingKind === "word";
  const wordFailed = failedKind === "word";
  const examplePlaying = playingKind === "example";
  const exampleLoading = loadingKind === "example";
  const exampleFailed = failedKind === "example";

  return (
    <div className="flashcard-perspective mx-auto w-full max-w-3xl">
      <div
        onClick={onFlip}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onFlip();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={
          flipped
            ? `Mặt sau nghĩa tiếng Việt của ${card.english_word}. Nhấn để lật về mặt tiếng Anh.`
            : `Mặt trước từ tiếng Anh ${card.english_word}. Nhấn để lật xem nghĩa tiếng Việt.`
        }
        className={`flashcard-inner grid cursor-pointer select-none [grid-template-areas:'card'] rounded-[28px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25 ${
          flipped ? "is-flipped" : ""
        }`}
      >
        {/* FRONT FACE: ENGLISH */}
        <div
          aria-hidden={flipped}
          className={`flashcard-face [grid-area:card] flex min-h-[340px] flex-col justify-between rounded-[28px] border border-white bg-white p-6 shadow-xl shadow-indigo-950/5 sm:min-h-[390px] sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none ${
            flipped ? "pointer-events-none" : ""
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${badge.className}`}
              >
                {badge.label}
              </span>
              {sessionGrade && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Đã chấm trong lượt này
                </span>
              )}
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                reviewInfo.isNew
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {reviewInfo.isNew ? (
                <Sparkles className="h-3.5 w-3.5" />
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
              {reviewInfo.text}
            </span>
          </div>

          <div className="my-8 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">
              Tiếng Anh
            </span>
            <h2 className="mt-3 max-w-full break-words text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
              {card.english_word}
            </h2>

            <div className="mt-6">
              {card.audio_path ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPlayAudio("word");
                  }}
                  disabled={wordLoading}
                  className={`inline-flex h-11 items-center gap-2.5 rounded-2xl border px-5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 disabled:opacity-60 ${
                    wordPlaying
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                      : wordFailed
                        ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                        : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900/70"
                  }`}
                  aria-label={wordPlaying ? "Dừng phát âm" : `Nghe phát âm ${card.english_word}`}
                >
                  {wordLoading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : wordFailed ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : wordPlaying ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                  {wordPlaying ? "Đang phát" : wordFailed ? "Thử lại" : "Nghe phát âm"}
                </button>
              ) : (
                <span className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-100 px-4 text-xs font-semibold text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                  <Headphones className="h-4 w-4" />
                  Chưa có audio phát âm
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
            <RotateCw className="h-3.5 w-3.5" />
            <span>Chạm vào thẻ hoặc nhấn Space để lật xem nghĩa</span>
          </div>
        </div>

        {/* BACK FACE: VIETNAMESE MEANING + OPTIONAL COLLAPSIBLE EXAMPLE */}
        <div
          aria-hidden={!flipped}
          className={`flashcard-face flashcard-face-back [grid-area:card] flex min-h-[340px] flex-col justify-between rounded-[28px] border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/35 to-violet-50/45 p-6 shadow-xl shadow-indigo-950/5 sm:min-h-[390px] sm:p-8 dark:border-indigo-900/60 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 dark:shadow-none ${
            !flipped ? "pointer-events-none" : ""
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="truncate text-sm font-extrabold text-slate-700 dark:text-slate-200">
                {card.english_word}
              </span>
              {card.audio_path && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPlayAudio("word");
                  }}
                  disabled={wordLoading}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition ${
                    wordPlaying
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 dark:border-indigo-900 dark:bg-slate-800 dark:text-indigo-300"
                  }`}
                  aria-label={`Nghe lại ${card.english_word}`}
                  title="Nghe lại từ tiếng Anh (R)"
                >
                  {wordLoading ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : wordPlaying ? (
                    <Pause className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  )}
                </button>
              )}
            </div>

            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>

          <div className="my-6 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
              Nghĩa tiếng Việt
            </span>
            <p className="mt-3 max-w-2xl break-words text-2xl font-extrabold leading-relaxed text-slate-900 sm:text-4xl dark:text-white">
              {card.vietnamese_meaning}
            </p>

            {card.example_english && (
              <div className="mt-6 w-full max-w-xl">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleExample();
                  }}
                  aria-expanded={exampleOpen}
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white/90 px-3.5 py-2 text-xs font-bold text-violet-700 shadow-xs transition hover:bg-violet-50 dark:border-violet-900 dark:bg-slate-800 dark:text-violet-300 dark:hover:bg-slate-700"
                >
                  <BookOpenText className="h-3.5 w-3.5" />
                  {exampleOpen ? "Ẩn ví dụ TOEIC" : "Xem ví dụ TOEIC"}
                  {exampleOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>

                {exampleOpen && (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    className="mt-3 rounded-2xl border border-violet-200/80 bg-white/95 p-4 text-left shadow-sm dark:border-violet-900/70 dark:bg-slate-950/80"
                  >
                    <p className="text-sm font-semibold leading-6 text-slate-800 dark:text-slate-100">
                      {card.example_annotated_english || card.example_english}
                    </p>
                    {card.example_vietnamese && (
                      <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {card.example_vietnamese}
                      </p>
                    )}
                    {card.example_audio_path && (
                      <button
                        type="button"
                        onClick={() => onPlayAudio("example")}
                        disabled={exampleLoading}
                        className={`mt-3 inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${
                          examplePlaying
                            ? "border-violet-600 bg-violet-600 text-white"
                            : exampleFailed
                              ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                              : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300"
                        }`}
                      >
                        {exampleLoading ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : exampleFailed ? (
                          <AlertCircle className="h-3.5 w-3.5" />
                        ) : examplePlaying ? (
                          <Pause className="h-3.5 w-3.5 fill-current" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-current" />
                        )}
                        {examplePlaying
                          ? "Dừng ví dụ"
                          : exampleFailed
                            ? "Thử lại"
                            : "Nghe câu ví dụ"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
            <span>Chọn mức độ bên dưới để lưu kết quả và sang thẻ tiếp theo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
