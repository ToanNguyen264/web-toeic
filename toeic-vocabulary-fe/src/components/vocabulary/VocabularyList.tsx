import {
  BookOpenText,
  Edit3,
  Inbox,
  LoaderCircle,
  MoreHorizontal,
  Star,
  Trash2,
  Volume2,
} from "lucide-react";
import type { Vocabulary, VocabularyStatus } from "../../types/vocabulary";
import { formatFileSize } from "../../utils/validation";
import { AudioButton } from "./AudioButton";
import { WordMeaningAudioButton } from "./WordMeaningAudioButton";

type VocabularyListProps = {
  items: Vocabulary[];
  loading: boolean;
  search: string;
  status: VocabularyStatus;
  activeAudioId: string | null;
  playlistPlaying: boolean;
  onActivateAudio: (id: string | null) => void;
  onEdit: (vocabulary: Vocabulary) => void;
  onDelete: (vocabulary: Vocabulary) => void;
  onToggleLearned: (vocabulary: Vocabulary) => void;
  learnedUpdatingId: string | null;
  onAdd: () => void;
};

function VocabularySkeleton() {
  return (
    <div className="space-y-3 p-4 sm:p-6">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="grid animate-pulse grid-cols-[0.8fr_1fr_1.5fr_140px_80px] gap-5 border-b border-slate-100 py-4 last:border-0 dark:border-slate-800"
        >
          <span className="h-5 rounded bg-slate-200 dark:bg-slate-800" />
          <span className="h-5 rounded bg-slate-100 dark:bg-slate-800" />
          <span className="h-12 rounded bg-slate-100 dark:bg-slate-800" />
          <span className="h-9 rounded-xl bg-slate-100 dark:bg-slate-800" />
          <span className="h-9 rounded-xl bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

export function VocabularyList({
  items,
  loading,
  search,
  status,
  activeAudioId,
  playlistPlaying,
  onActivateAudio,
  onEdit,
  onDelete,
  onToggleLearned,
  learnedUpdatingId,
  onAdd,
}: VocabularyListProps) {
  if (loading) return <VocabularySkeleton />;

  if (!items.length) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center px-6 py-14 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-indigo-50 text-indigo-500 dark:bg-indigo-950 dark:text-indigo-300">
          {search ? <Inbox className="h-7 w-7" /> : <Volume2 className="h-7 w-7" />}
        </div>
        <h3 className="mt-5 text-lg font-extrabold text-slate-900 dark:text-white">
          {search
            ? "Không tìm thấy từ phù hợp"
            : status === "learned"
              ? "Chưa có từ đã thuộc"
              : status === "unlearned"
                ? "Danh sách chưa thuộc đang trống"
                : "Kho từ vựng đang trống"}
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
          {search
            ? "Thử một từ khóa khác hoặc xóa bộ lọc tìm kiếm."
            : status === "learned"
              ? "Bấm biểu tượng ngôi sao ở danh sách chưa thuộc để chuyển từ sang đây."
              : "Thêm từ đầu tiên cùng file phát âm để bắt đầu luyện nghe."}
        </p>
        {!search && status !== "learned" && (
          <button
            type="button"
            onClick={onAdd}
            className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            Thêm từ đầu tiên
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 shadow-sm shadow-slate-200/50 dark:shadow-slate-950/50">
            <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              <th className="px-6 py-4">Tiếng Anh</th>
              <th className="px-6 py-4">Tiếng Việt</th>
              <th className="px-6 py-4">Ví dụ TOEIC</th>
              <th className="px-6 py-4">Audio</th>
              <th className="px-6 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <tr key={item.id} className="group transition hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20">
                <td className="px-6 py-5 align-top">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleLearned(item)}
                      disabled={learnedUpdatingId === item.id}
                      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition disabled:cursor-wait disabled:opacity-60 ${
                        item.is_learned
                          ? "bg-amber-100 text-amber-500 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-500 dark:bg-slate-800 dark:hover:bg-amber-950"
                      }`}
                      aria-label={
                        item.is_learned
                          ? `Đánh dấu ${item.english_word} là chưa thuộc`
                          : `Đánh dấu ${item.english_word} là đã thuộc`
                      }
                      title={item.is_learned ? "Chuyển về chưa thuộc" : "Đánh dấu đã thuộc"}
                    >
                      {learnedUpdatingId === item.id ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Star
                          className={`h-4 w-4 ${item.is_learned ? "fill-current" : ""}`}
                        />
                      )}
                    </button>
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-900 dark:text-white">
                        {item.english_word}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(
                          new Date(item.created_at),
                        )}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="max-w-md px-6 py-5 align-top text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {item.vietnamese_meaning}
                </td>
                <td className="max-w-lg px-6 py-5 align-top">
                  {item.example_english ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold leading-6 text-slate-800 dark:text-slate-100">
                        {item.example_english}
                      </p>
                      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {item.example_vietnamese}
                      </p>
                      <AudioButton
                        id={item.id}
                        kind="example"
                        path={item.example_audio_path}
                        name={item.example_audio_name}
                        isActive={activeAudioId === `${item.id}:example`}
                        externallyPlaying={
                          playlistPlaying && activeAudioId === `${item.id}:example`
                        }
                        onActivate={onActivateAudio}
                        compact
                      />
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                      <BookOpenText className="h-4 w-4" /> Chưa có ví dụ
                    </span>
                  )}
                </td>
                <td className="px-6 py-5 align-top">
                  <div className="flex flex-col items-start gap-2">
                    <AudioButton
                      id={item.id}
                      path={item.audio_path}
                      name={item.audio_name}
                      isActive={activeAudioId === item.id}
                      externallyPlaying={playlistPlaying && activeAudioId === item.id}
                      onActivate={onActivateAudio}
                    />
                    <WordMeaningAudioButton
                      key={`${item.id}:${item.updated_at}:meaning`}
                      id={item.id}
                      english={item.english_word}
                      path={item.word_meaning_audio_path}
                      isActive={activeAudioId === `${item.id}:meaning`}
                      onActivate={onActivateAudio}
                    />
                  </div>
                  {item.audio_size ? (
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      {formatFileSize(item.audio_size)}
                    </p>
                  ) : null}
                </td>
                <td className="px-6 py-5 align-top">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
                      aria-label={`Sửa ${item.english_word}`}
                      title="Sửa"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950 dark:hover:text-rose-300"
                      aria-label={`Xóa ${item.english_word}`}
                      title="Xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
        {items.map((item) => (
          <article key={item.id} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={() => onToggleLearned(item)}
                  disabled={learnedUpdatingId === item.id}
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl transition disabled:cursor-wait disabled:opacity-60 ${
                    item.is_learned
                      ? "bg-amber-100 text-amber-500 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                  }`}
                  aria-label={
                    item.is_learned
                      ? `Đánh dấu ${item.english_word} là chưa thuộc`
                      : `Đánh dấu ${item.english_word} là đã thuộc`
                  }
                >
                  {learnedUpdatingId === item.id ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Star className={`h-4 w-4 ${item.is_learned ? "fill-current" : ""}`} />
                  )}
                </button>
                <div className="min-w-0">
                <h3 className="break-words text-lg font-extrabold text-slate-900 dark:text-white">
                  {item.english_word}
                </h3>
                <p className="mt-1 break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {item.vietnamese_meaning}
                </p>
                </div>
              </div>
              <MoreHorizontal className="mt-1 h-5 w-5 shrink-0 text-slate-300" />
            </div>
            {item.example_english && (
              <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-3.5 dark:border-violet-900 dark:bg-violet-950/20">
                <div className="flex items-start gap-3">
                  <BookOpenText className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-6 text-slate-800 dark:text-slate-100">
                      {item.example_english}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {item.example_vietnamese}
                    </p>
                    <div className="mt-2">
                      <AudioButton
                        id={item.id}
                        kind="example"
                        path={item.example_audio_path}
                        name={item.example_audio_name}
                        isActive={activeAudioId === `${item.id}:example`}
                        externallyPlaying={
                          playlistPlaying && activeAudioId === `${item.id}:example`
                        }
                        onActivate={onActivateAudio}
                        compact
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2">
                <AudioButton
                  id={item.id}
                  path={item.audio_path}
                  name={item.audio_name}
                  isActive={activeAudioId === item.id}
                  externallyPlaying={playlistPlaying && activeAudioId === item.id}
                  onActivate={onActivateAudio}
                />
                <WordMeaningAudioButton
                  key={`${item.id}:${item.updated_at}:meaning`}
                  id={item.id}
                  english={item.english_word}
                  path={item.word_meaning_audio_path}
                  isActive={activeAudioId === `${item.id}:meaning`}
                  onActivate={onActivateAudio}
                />
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-500 shadow-sm dark:bg-slate-800"
                  aria-label={`Sửa ${item.english_word}`}
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-white text-rose-500 shadow-sm dark:bg-slate-800"
                  aria-label={`Xóa ${item.english_word}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
