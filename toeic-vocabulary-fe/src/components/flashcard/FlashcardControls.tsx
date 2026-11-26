import {
  ArrowLeft,
  ArrowRight,
  CircleDashed,
  LoaderCircle,
  RotateCw,
  Sparkles,
  Star,
} from "lucide-react";
import type { MasteryLevel } from "../../types/vocabulary";

type FlashcardControlsProps = {
  canPrev: boolean;
  isLastCard: boolean;
  flipped: boolean;
  currentMastery: MasteryLevel;
  ratingLoadingLevel: MasteryLevel | null;
  onPrev: () => void;
  onFlip: () => void;
  onNext: () => void;
  onRate: (level: MasteryLevel) => void;
};

export function FlashcardControls({
  canPrev,
  isLastCard,
  flipped,
  currentMastery,
  ratingLoadingLevel,
  onPrev,
  onFlip,
  onNext,
  onRate,
}: FlashcardControlsProps) {
  return (
    <div className="mx-auto mt-6 w-full max-w-3xl space-y-4">
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => onRate("unlearned")}
          disabled={ratingLoadingLevel !== null}
          className={`group flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3.5 text-center font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/20 disabled:opacity-60 sm:flex-row sm:gap-2.5 sm:py-4 ${
            currentMastery === "unlearned" && flipped
              ? "border-cyan-400 bg-cyan-50 text-cyan-800 shadow-sm dark:border-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-200"
              : "border-cyan-200 bg-white text-cyan-700 hover:border-cyan-300 hover:bg-cyan-50/80 dark:border-cyan-900/70 dark:bg-slate-900 dark:text-cyan-300 dark:hover:bg-cyan-950/50"
          }`}
        >
          {ratingLoadingLevel === "unlearned" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <CircleDashed className="h-4 w-4 shrink-0" />
          )}
          <span className="text-xs sm:text-sm">Chưa thuộc</span>
          <kbd className="hidden rounded-md border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-extrabold text-cyan-700 md:inline-block dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
            1
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => onRate("learning")}
          disabled={ratingLoadingLevel !== null}
          className={`group flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3.5 text-center font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/20 disabled:opacity-60 sm:flex-row sm:gap-2.5 sm:py-4 ${
            currentMastery === "learning" && flipped
              ? "border-violet-400 bg-violet-50 text-violet-800 shadow-sm dark:border-violet-700 dark:bg-violet-950/70 dark:text-violet-200"
              : "border-violet-200 bg-white text-violet-700 hover:border-violet-300 hover:bg-violet-50/80 dark:border-violet-900/70 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-violet-950/50"
          }`}
        >
          {ratingLoadingLevel === "learning" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0" />
          )}
          <span className="text-xs sm:text-sm">Thuộc sơ sơ</span>
          <kbd className="hidden rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-extrabold text-violet-700 md:inline-block dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300">
            2
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => onRate("mastered")}
          disabled={ratingLoadingLevel !== null}
          className={`group flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3.5 text-center font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/20 disabled:opacity-60 sm:flex-row sm:gap-2.5 sm:py-4 ${
            currentMastery === "mastered" && flipped
              ? "border-amber-400 bg-amber-50 text-amber-800 shadow-sm dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-200"
              : "border-amber-200 bg-white text-amber-700 hover:border-amber-300 hover:bg-amber-50/80 dark:border-amber-900/70 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-950/50"
          }`}
        >
          {ratingLoadingLevel === "mastered" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Star className="h-4 w-4 shrink-0 fill-current" />
          )}
          <span className="text-xs sm:text-sm">Thuộc kĩ</span>
          <kbd className="hidden rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-700 md:inline-block dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            3
          </kbd>
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-40 sm:flex-none sm:px-5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Trước
        </button>

        <button
          type="button"
          onClick={onFlip}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-violet-500 sm:flex-none sm:px-7"
        >
          <RotateCw className="h-4 w-4" />
          {flipped ? "Lật về Tiếng Anh" : "Lật xem nghĩa"}
        </button>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 sm:flex-none sm:px-5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {isLastCard ? "Tổng kết" : "Tiếp theo"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <p className="hidden items-center justify-center gap-3 text-center text-xs text-slate-400 md:flex dark:text-slate-500">
        <span>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Space
          </kbd>{" "}
          Lật thẻ
        </span>
        <span>·</span>
        <span>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            ←
          </kbd>{" "}
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            →
          </kbd>{" "}
          Chuyển thẻ
        </span>
        <span>·</span>
        <span>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            1
          </kbd>{" "}
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            2
          </kbd>{" "}
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            3
          </kbd>{" "}
          Chấm mức độ
        </span>
        <span>·</span>
        <span>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            R
          </kbd>{" "}
          Nghe lại
        </span>
        <span>·</span>
        <span>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            E
          </kbd>{" "}
          Mở ví dụ
        </span>
      </p>
    </div>
  );
}
