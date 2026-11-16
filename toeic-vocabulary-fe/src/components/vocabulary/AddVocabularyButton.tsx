import { Plus } from "lucide-react";

type AddVocabularyButtonProps = {
  onClick: () => void;
};

export function AddVocabularyButton({ onClick }: AddVocabularyButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl border border-white/30 bg-white px-4 py-3 text-left text-indigo-700 shadow-lg shadow-indigo-950/15 transition hover:-translate-y-0.5 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700 transition group-hover:bg-indigo-200">
        <Plus className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-extrabold">Thêm từ mới</span>
        <span className="mt-0.5 block text-xs text-indigo-500">
          Lưu từ, nghĩa và audio
        </span>
      </span>
    </button>
  );
}
