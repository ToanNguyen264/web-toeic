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
    <section className="mb-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => onStatusChange("all")}
          className={`flex items-center gap-3.5 rounded-2xl border p-3.5 text-left shadow-sm backdrop-blur transition ${
            status === "all"
              ? "border-indigo-300 bg-indigo-50 ring-4 ring-indigo-500/10 dark:border-indigo-800 dark:bg-indigo-950/40"
              : "border-white bg-white/90 hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-indigo-900"
          }`}
          aria-pressed={status === "all"}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            <LibraryBig className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">Tất cả từ</p>
            <p className="mt-0.5 text-lg font-extrabold text-slate-900 dark:text-white">
              {statsLoading ? "—" : totalVocab}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onStatusChange("unlearned")}
          className={`flex items-center gap-3.5 rounded-2xl border p-3.5 text-left shadow-sm backdrop-blur transition ${
            status === "unlearned"
              ? "border-cyan-300 bg-cyan-50 ring-4 ring-cyan-500/10 dark:border-cyan-800 dark:bg-cyan-950/40"
              : "border-white bg-white/90 hover:border-cyan-200 hover:bg-cyan-50/50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-cyan-900"
          }`}
          aria-pressed={status === "unlearned"}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
            <CircleDashed className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">Chưa thuộc</p>
            <p className="mt-0.5 text-lg font-extrabold text-slate-900 dark:text-white">
              {statsLoading ? "—" : stats?.unlearned ?? 0}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onStatusChange("learning")}
          className={`flex items-center gap-3.5 rounded-2xl border p-3.5 text-left shadow-sm backdrop-blur transition ${
            status === "learning"
              ? "border-violet-300 bg-violet-50 ring-4 ring-violet-500/10 dark:border-violet-800 dark:bg-violet-950/40"
              : "border-white bg-white/90 hover:border-violet-200 hover:bg-violet-50/50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-violet-900"
          }`}
          aria-pressed={status === "learning"}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">Thuộc sơ sơ</p>
            <p className="mt-0.5 text-lg font-extrabold text-slate-900 dark:text-white">
              {statsLoading ? "—" : stats?.learning ?? 0}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onStatusChange("mastered")}
          className={`flex items-center gap-3.5 rounded-2xl border p-3.5 text-left shadow-sm backdrop-blur transition ${
            status === "mastered"
              ? "border-amber-300 bg-amber-50 ring-4 ring-amber-500/10 dark:border-amber-800 dark:bg-amber-950/40"
              : "border-white bg-white/90 hover:border-amber-200 hover:bg-amber-50/50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-amber-900"
          }`}
          aria-pressed={status === "mastered"}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300">
            <Star className="h-5 w-5 fill-current" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">Thuộc kĩ</p>
            <p className="mt-0.5 text-lg font-extrabold text-slate-900 dark:text-white">
              {statsLoading ? "—" : stats?.mastered ?? 0}
            </p>
          </div>
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white bg-white/95 p-3.5 shadow-sm backdrop-blur lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-900/95">
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

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            Mỗi lượt
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
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${
              shuffleEnabled
                ? "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
            title="Xáo trộn ngẫu nhiên thứ tự thẻ trong lượt học"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Xáo trộn
          </button>

          <button
            type="button"
            onClick={onToggleAutoPlay}
            aria-pressed={autoPlay}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${
              autoPlay
                ? "border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
            title="Tự động phát audio phát âm khi mở sang thẻ mới"
          >
            {autoPlay ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
            Tự phát âm
          </button>

          <button
            type="button"
            onClick={onReloadPool}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-800 dark:hover:bg-indigo-950"
            title="Lấy lại lượt học mới ưu tiên các từ lâu chưa ôn"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Lượt mới
          </button>
        </div>
      </div>
    </section>
  );
}
