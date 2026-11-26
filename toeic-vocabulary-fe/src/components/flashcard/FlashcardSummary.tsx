import {
  CheckCircle2,
  CircleDashed,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "../ui/Button";
import type { MasteryLevel } from "../../types/vocabulary";

type FlashcardSummaryProps = {
  totalCards: number;
  sessionGrades: Record<string, MasteryLevel>;
  weakCount: number;
  onNextPriorityBatch: () => void;
  onReviewWeakCards: () => void;
  onRestartSameDeck: () => void;
};

export function FlashcardSummary({
  totalCards,
  sessionGrades,
  weakCount,
  onNextPriorityBatch,
  onReviewWeakCards,
  onRestartSameDeck,
}: FlashcardSummaryProps) {
  const grades = Object.values(sessionGrades);
  const masteredCount = grades.filter((level) => level === "mastered").length;
  const learningCount = grades.filter((level) => level === "learning").length;
  const unlearnedCount = grades.filter((level) => level === "unlearned").length;
  const skippedCount = Math.max(0, totalCards - grades.length);

  return (
    <div className="mx-auto max-w-2xl rounded-[28px] border border-white bg-white/95 p-6 text-center shadow-xl shadow-indigo-950/5 sm:p-10 dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-none">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 text-white shadow-lg shadow-indigo-600/25">
        <CheckCircle2 className="h-8 w-8" />
      </div>

      <h2 className="mt-5 text-2xl font-extrabold text-slate-950 sm:text-3xl dark:text-white">
        Hoàn thành lượt ôn tập!
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
        Bạn vừa đi qua <strong className="text-slate-800 dark:text-slate-200">{totalCards}</strong>{" "}
        thẻ từ vựng. Lịch sử ôn tập đã được lưu để ưu tiên các từ lâu chưa học cho lượt kế tiếp.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="mx-auto grid h-8 w-8 place-items-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300">
            <Star className="h-4 w-4 fill-current" />
          </div>
          <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
            {masteredCount}
          </p>
          <p className="text-xs font-semibold text-slate-500">Thuộc kĩ</p>
        </div>

        <div className="rounded-2xl border border-violet-200/80 bg-violet-50/70 p-3.5 dark:border-violet-900/60 dark:bg-violet-950/30">
          <div className="mx-auto grid h-8 w-8 place-items-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
            {learningCount}
          </p>
          <p className="text-xs font-semibold text-slate-500">Thuộc sơ sơ</p>
        </div>

        <div className="rounded-2xl border border-cyan-200/80 bg-cyan-50/70 p-3.5 dark:border-cyan-900/60 dark:bg-cyan-950/30">
          <div className="mx-auto grid h-8 w-8 place-items-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
            <CircleDashed className="h-4 w-4" />
          </div>
          <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
            {unlearnedCount}
          </p>
          <p className="text-xs font-semibold text-slate-500">Chưa thuộc</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="mx-auto grid h-8 w-8 place-items-center rounded-xl bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <RotateCcw className="h-4 w-4" />
          </div>
          <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
            {skippedCount}
          </p>
          <p className="text-xs font-semibold text-slate-500">Chưa chấm</p>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
        <Button onClick={onNextPriorityBatch}>
          <RefreshCw className="h-4 w-4" />
          Ôn tiếp lượt ưu tiên mới
        </Button>

        {weakCount > 0 && (
          <Button variant="secondary" onClick={onReviewWeakCards}>
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Ôn lại {weakCount} từ chưa vững
          </Button>
        )}

        <Button variant="ghost" onClick={onRestartSameDeck}>
          <RotateCcw className="h-4 w-4" />
          Học lại bộ thẻ này
        </Button>
      </div>
    </div>
  );
}
