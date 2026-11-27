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
      shortText: "Chưa ôn",
      isNew: true,
    };
  }
  const formattedDate = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
  }).format(new Date(card.last_reviewed_at));
  return {
    text: `Đã ôn ${card.review_count} lần · ${formattedDate}`,
    shortText: `Ôn ${card.review_count}× · ${formattedDate}`,
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
    <div className="flashcard-perspective mx-auto w-full max-w-3xl min-w-0">
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
        className={`flashcard-inner grid w-full min-w-0 cursor-pointer select-none grid-cols-[minmax(0,1fr)] [grid-template-areas:'card'] rounded-[22px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25 sm:rounded-[28px] ${
          flipped ? "is-flipped" : ""
        }`}
      >
        {/* FRONT FACE: ENGLISH */}
        <div
          aria-hidden={flipped}
          className={`flashcard-face [grid-area:card] flex min-h-[225px] w-full min-w-0 flex-col justify-between overflow-hidden rounded-[22px] border border-white bg-white p-4 shadow-xl shadow-indigo-950/5 sm:min-h-[370px] sm:rounded-[28px] sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none ${
            flipped ? "pointer-events-none" : ""
          }`}
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold sm:px-3 sm:py-1 sm:text-xs ${badge.className}`}
              >
                {badge.label}
              </span>
              {sessionGrade && (
                <span className="truncate rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 sm:px-2.5 sm:py-1 sm:text-[11px] dark:bg-emerald-950/60 dark:text-emerald-300">
                  Đã chấm
                </span>
              )}
            </div>

            <span
              className={`inline-flex min-w-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs ${
                reviewInfo.isNew
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {reviewInfo.isNew ? (
                <Sparkles className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
              ) : (
                <Clock className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
              )}
              <span className="truncate sm:hidden">{reviewInfo.shortText}</span>
              <span className="hidden truncate sm:inline">{reviewInfo.text}</span>
            </span>
          </div>

          <div className="my-4 flex min-w-0 flex-col items-center justify-center text-center sm:my-8">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-500 sm:text-[11px] dark:text-indigo-400">
              Tiếng Anh
            </span>
            <h2 className="mt-1.5 max-w-full break-words text-2xl font-extrabold tracking-tight text-slate-950 sm:mt-3 sm:text-5xl dark:text-white">
              {card.english_word}
            </h2>

            <div className="mt-4 sm:mt-6">
              {card.audio_path ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPlayAudio("word");
                  }}
                  disabled={wordLoading}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 disabled:opacity-60 sm:min-h-11 sm:gap-2.5 sm:px-5 sm:py-2.5 sm:text-sm ${
                    wordPlaying
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                      : wordFailed
                        ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                        : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900/70"
                  }`}
                  aria-label={wordPlaying ? "Dừng phát âm" : `Nghe phát âm ${card.english_word}`}
                >
                  {wordLoading ? (
                    <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
                  ) : wordFailed ? (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  ) : wordPlaying ? (
                    <Pause className="h-4 w-4 shrink-0 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 shrink-0 fill-current" />
                  )}
                  <span>{wordPlaying ? "Đang phát" : wordFailed ? "Thử lại" : "Nghe phát âm"}</span>
                </button>
              ) : (
                <span className="inline-flex min-h-9 items-center gap-1.5 rounded-2xl bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-400 sm:min-h-10 sm:px-4 sm:py-2 dark:bg-slate-800 dark:text-slate-500">
                  <Headphones className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span>Chưa có audio</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex min-w-0 items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-slate-400 sm:text-xs dark:text-slate-500">
            <RotateCw className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
            <span className="truncate sm:hidden">Chạm vào thẻ để lật xem nghĩa</span>
            <span className="hidden sm:inline">
              Nhấn vào thẻ hoặc phím Space để lật xem nghĩa
            </span>
          </div>
        </div>

        {/* BACK FACE: VIETNAMESE MEANING + OPTIONAL COLLAPSIBLE EXAMPLE */}
        <div
          aria-hidden={!flipped}
          className={`flashcard-face flashcard-face-back [grid-area:card] flex min-h-[225px] w-full min-w-0 flex-col justify-between overflow-hidden rounded-[22px] border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/35 to-violet-50/45 p-4 shadow-xl shadow-indigo-950/5 sm:min-h-[370px] sm:rounded-[28px] sm:p-8 dark:border-indigo-900/60 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 dark:shadow-none ${
            !flipped ? "pointer-events-none" : ""
          }`}
        >
          <div className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-100 pb-3 sm:pb-4 dark:border-slate-800">
            <div className="flex min-w-0 items-center gap-2">
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
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition sm:h-8 sm:w-8 sm:rounded-xl ${
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
              className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold sm:px-3 sm:py-1 sm:text-xs ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>

          <div className="my-4 flex min-w-0 flex-col items-center justify-center text-center sm:my-6">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-violet-600 sm:text-[11px] dark:text-violet-400">
              Nghĩa tiếng Việt
            </span>
            <p className="mt-1.5 max-w-full break-words text-lg font-extrabold leading-snug text-slate-900 sm:mt-3 sm:max-w-2xl sm:text-4xl sm:leading-relaxed dark:text-white">
              {card.vietnamese_meaning}
            </p>

            {card.example_english && (
              <div className="mt-4 w-full max-w-xl min-w-0 sm:mt-6">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleExample();
                  }}
                  aria-expanded={exampleOpen}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-violet-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-violet-700 shadow-xs transition hover:bg-violet-50 sm:min-h-9 sm:gap-2 sm:px-3.5 sm:py-2 dark:border-violet-900 dark:bg-slate-800 dark:text-violet-300 dark:hover:bg-slate-700"
                >
                  <BookOpenText className="h-3.5 w-3.5 shrink-0" />
                  <span>{exampleOpen ? "Ẩn ví dụ TOEIC" : "Xem ví dụ TOEIC"}</span>
                  {exampleOpen ? (
                    <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  )}
                </button>

                {exampleOpen && (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    className="mt-2.5 rounded-2xl border border-violet-200/80 bg-white/95 p-3 text-left shadow-sm sm:mt-3 sm:p-4 dark:border-violet-900/70 dark:bg-slate-950/80"
                  >
                    <p className="break-words text-xs font-semibold leading-5 text-slate-800 sm:text-sm sm:leading-6 dark:text-slate-100">
                      {card.example_annotated_english || card.example_english}
                    </p>
                    {card.example_vietnamese && (
                      <p className="mt-1 break-words text-xs leading-5 text-slate-500 sm:mt-1.5 dark:text-slate-400">
                        {card.example_vietnamese}
                      </p>
                    )}
                    {card.example_audio_path && (
                      <button
                        type="button"
                        onClick={() => onPlayAudio("example")}
                        disabled={exampleLoading}
                        className={`mt-2.5 inline-flex min-h-8 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition sm:mt-3 sm:min-h-9 sm:gap-2 sm:py-2 ${
                          examplePlaying
                            ? "border-violet-600 bg-violet-600 text-white"
                            : exampleFailed
                              ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                              : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300"
                        }`}
                      >
                        {exampleLoading ? (
                          <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
                        ) : exampleFailed ? (
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        ) : examplePlaying ? (
                          <Pause className="h-3.5 w-3.5 shrink-0 fill-current" />
                        ) : (
                          <Play className="h-3.5 w-3.5 shrink-0 fill-current" />
                        )}
                        <span>
                          {examplePlaying
                            ? "Dừng ví dụ"
                            : exampleFailed
                              ? "Thử lại"
                              : "Nghe câu ví dụ"}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-center text-center text-[11px] font-semibold text-slate-400 sm:text-xs dark:text-slate-500">
            <span className="truncate">Chọn mức độ bên dưới để lưu và sang thẻ tiếp</span>
          </div>
        </div>
      </div>
    </div>
  );
}
