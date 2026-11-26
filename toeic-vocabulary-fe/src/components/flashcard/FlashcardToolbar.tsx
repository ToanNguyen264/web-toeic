import {
  CircleDashed,
  LibraryBig,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { VocabularyStatus } from "../../types/vocabulary";

export type DeckSize = 10 | 20 | 50 | "all";

type FlashcardToolbarProps = {
  status: VocabularyStatus;
  onStatusChange: (status: VocabularyStatus) => void;
  stats:
    | {
        unlearned: number;
        learning: number;
        mastered: number;
      }
    | undefined;
  statsLoading: boolean;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  deckSize: DeckSize;
  onDeckSizeChange: (size: DeckSize) => void;
  shuffleEnabled: boolean;
  onToggleShuffle: () => void;
  onReloadPool: () => void;
  autoPlay: boolean;
  onToggleAutoPlay: () => void;
};

export function FlashcardToolbar({
  status,
  onStatusChange,
  stats,
  statsLoading,
  searchInput,
  onSearchInputChange,
  deckSize,
  onDeckSizeChange,
  shuffleEnabled,
  onToggleShuffle,
  onReloadPool,
  autoPlay,
  onToggleAutoPlay,
}: FlashcardToolbarProps) {
  const totalVocab =
    (stats?.unlearned ?? 0) + (stats?.learning ?? 0) + (stats?.mastered ?? 0);

  return (
    <section className="mb-5 space-y-3 sm:mb-6 sm:space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => onStatusChange("all")}
          className={`flex min-w-0 items-center gap-2.5 rounded-2xl border p-2.5 text-left shadow-sm backdrop-blur transition sm:gap-3.5 sm:p-3.5 ${
            status === "all"
              ? "border-indigo-300 bg-indigo-50 ring-4 ring-indigo-500/10 dark:border-indigo-800 dark:bg-indigo-950/40"
              : "border-white bg-white/90 hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-indigo-900"
          }`}
          aria-pressed={status === "all"}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700 sm:h-10 sm:w-10 dark:bg-indigo-950 dark:text-indigo-300">
            <LibraryBig className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-slate-500 sm:text-xs">
              Tất cả từ
            </p>
            <p className="mt-0.5 text-base font-extrabold text-slate-900 sm:text-lg dark:text-white">
              {statsLoading ? "—" : totalVocab}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onStatusChange("unlearned")}
          className={`flex min-w-0 items-center gap-2.5 rounded-2xl border p-2.5 text-left shadow-sm backdrop-blur transition sm:gap-3.5 sm:p-3.5 ${
            status === "unlearned"
              ? "border-cyan-300 bg-cyan-50 ring-4 ring-cyan-500/10 dark:border-cyan-800 dark:bg-cyan-950/40"
              : "border-white bg-white/90 hover:border-cyan-200 hover:bg-cyan-50/50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-cyan-900"
          }`}
          aria-pressed={status === "unlearned"}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-100 text-cyan-700 sm:h-10 sm:w-10 dark:bg-cyan-950 dark:text-cyan-300">
            <CircleDashed className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-slate-500 sm:text-xs">
              Chưa thuộc
            </p>
            <p className="mt-0.5 text-base font-extrabold text-slate-900 sm:text-lg dark:text-white">
              {statsLoading ? "—" : stats?.unlearned ?? 0}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onStatusChange("learning")}
          className={`flex min-w-0 items-center gap-2.5 rounded-2xl border p-2.5 text-left shadow-sm backdrop-blur transition sm:gap-3.5 sm:p-3.5 ${
            status === "learning"
              ? "border-violet-300 bg-violet-50 ring-4 ring-violet-500/10 dark:border-violet-800 dark:bg-violet-950/40"
              : "border-white bg-white/90 hover:border-violet-200 hover:bg-violet-50/50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-violet-900"
          }`}
          aria-pressed={status === "learning"}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-600 sm:h-10 sm:w-10 dark:bg-violet-950 dark:text-violet-300">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-slate-500 sm:text-xs">
              Thuộc sơ sơ
            </p>
            <p className="mt-0.5 text-base font-extrabold text-slate-900 sm:text-lg dark:text-white">
              {statsLoading ? "—" : stats?.learning ?? 0}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onStatusChange("mastered")}
          className={`flex min-w-0 items-center gap-2.5 rounded-2xl border p-2.5 text-left shadow-sm backdrop-blur transition sm:gap-3.5 sm:p-3.5 ${
            status === "mastered"
              ? "border-amber-300 bg-amber-50 ring-4 ring-amber-500/10 dark:border-amber-800 dark:bg-amber-950/40"
              : "border-white bg-white/90 hover:border-amber-200 hover:bg-amber-50/50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-amber-900"
          }`}
          aria-pressed={status === "mastered"}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600 sm:h-10 sm:w-10 dark:bg-amber-950 dark:text-amber-300">
            <Star className="h-4 w-4 fill-current sm:h-5 sm:w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-slate-500 sm:text-xs">
              Thuộc kĩ
            </p>
            <p className="mt-0.5 text-base font-extrabold text-slate-900 sm:text-lg dark:text-white">
              {statsLoading ? "—" : stats?.mastered ?? 0}
            </p>
          </div>
        </button>
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-white bg-white/95 p-3 shadow-sm backdrop-blur sm:gap-3 sm:p-3.5 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-900/95">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="flashcard-search"
            name="flashcardSearch"
            type="search"
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Tìm từ trong bộ thẻ…"
            aria-label="Tìm từ trong bộ thẻ"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-900"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => onSearchInputChange("")}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              aria-label="Xóa từ khóa"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <label className="flex min-h-10 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold whitespace-nowrap text-slate-600 sm:justify-start dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <span>Mỗi lượt</span>
            <select
              value={String(deckSize)}
              onChange={(event) => {
                const raw = event.target.value;
                onDeckSizeChange(raw === "all" ? "all" : (Number(raw) as DeckSize));
              }}
              className="bg-transparent font-bold text-slate-900 outline-none dark:text-white"
              aria-label="Số lượng thẻ mỗi lượt học"
            >
              <option value="10">10 thẻ</option>
              <option value="20">20 thẻ</option>
              <option value="50">50 thẻ</option>
              <option value="all">Tất cả</option>
            </select>
          </label>

          <button
            type="button"
            onClick={onToggleShuffle}
            aria-pressed={shuffleEnabled}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold whitespace-nowrap transition sm:gap-2 ${
              shuffleEnabled
                ? "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
            title="Xáo trộn ngẫu nhiên thứ tự thẻ trong lượt học"
          >
            <Shuffle className="h-3.5 w-3.5 shrink-0" />
            <span>Xáo trộn</span>
          </button>

          <button
            type="button"
            onClick={onToggleAutoPlay}
            aria-pressed={autoPlay}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold whitespace-nowrap transition sm:gap-2 ${
              autoPlay
                ? "border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
            title="Tự động phát audio phát âm khi mở sang thẻ mới"
          >
            {autoPlay ? (
              <Volume2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>Tự phát âm</span>
          </button>

          <button
            type="button"
            onClick={onReloadPool}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold whitespace-nowrap text-slate-700 shadow-xs transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 sm:gap-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950"
            title="Lấy lại lượt học mới ưu tiên các từ lâu chưa ôn"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            <span>Lượt mới</span>
          </button>
        </div>
      </div>
    </section>
  );
}
