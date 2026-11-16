import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Headphones,
  LibraryBig,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Pagination } from "../components/vocabulary/Pagination";
import { VocabularyFormModal } from "../components/vocabulary/VocabularyFormModal";
import { VocabularyList } from "../components/vocabulary/VocabularyList";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { useVocabularies } from "../hooks/useVocabularies";
import {
  createVocabulary,
  deleteVocabulary,
  hasDuplicateVocabulary,
  updateVocabulary,
} from "../services/vocabulary.service";
import type { Vocabulary, VocabularyFormValues } from "../types/vocabulary";
import { toUserMessage } from "../utils/errors";
import { PAGE_SIZE } from "../utils/validation";

export default function VocabularyPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vocabulary | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Vocabulary | null>(null);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const vocabularyQuery = useVocabularies(user?.id, search, page);
  const data = vocabularyQuery.data;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const audioCount = useMemo(
    () => data?.items.filter((item) => item.audio_path || item.example_audio_path).length ?? 0,
    [data?.items],
  );

  const saveMutation = useMutation({
    mutationFn: async (values: VocabularyFormValues) => {
      if (!user) throw new Error("Phiên đăng nhập không hợp lệ.");
      const duplicate = await hasDuplicateVocabulary(
        user.id,
        values.englishWord,
        editing?.id,
      );
      if (
        duplicate &&
        !window.confirm(
          `Từ “${values.englishWord}” đã có trong danh sách. Bạn vẫn muốn lưu thêm nghĩa này?`,
        )
      ) {
        return { cancelled: true } as const;
      }

      if (editing) {
        await updateVocabulary(user.id, editing, values);
      } else {
        await createVocabulary(user.id, values);
      }
      return { cancelled: false } as const;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (vocabulary: Vocabulary) => {
      if (!user) throw new Error("Phiên đăng nhập không hợp lệ.");
      await deleteVocabulary(user.id, vocabulary);
    },
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(vocabulary: Vocabulary) {
    setEditing(vocabulary);
    setFormOpen(true);
  }

  async function handleSave(values: VocabularyFormValues) {
    try {
      const result = await saveMutation.mutateAsync(values);
      if (result.cancelled) return;
      await queryClient.invalidateQueries({ queryKey: ["vocabularies", user?.id] });
      showToast(editing ? "Đã cập nhật từ vựng." : "Đã thêm từ vựng mới.", "success");
      setFormOpen(false);
      setEditing(null);
      if (!editing) setPage(1);
    } catch (error) {
      showToast(toUserMessage(error, "Không thể lưu từ vựng. Vui lòng thử lại."), "error");
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await deleteMutation.mutateAsync(pendingDelete);
      setActiveAudioId((current) =>
        current === pendingDelete.id || current === `${pendingDelete.id}:example`
          ? null
          : current,
      );
      if ((data?.items.length ?? 0) === 1 && page > 1) setPage((current) => current - 1);
      await queryClient.invalidateQueries({ queryKey: ["vocabularies", user?.id] });
      showToast(`Đã xóa “${pendingDelete.english_word}”.`, "success");
      setPendingDelete(null);
    } catch (error) {
      showToast(toUserMessage(error, "Không thể xóa từ vựng."), "error");
    }
  }

  return (
    <AppShell>
      <section className="mb-7 overflow-hidden rounded-[28px] bg-gradient-to-r from-indigo-700 via-violet-700 to-cyan-700 p-6 text-white shadow-xl shadow-indigo-900/15 sm:p-8">
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/10 blur-2xl" />
          <div className="relative max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
              Kho từ vựng cá nhân
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Lưu hôm nay, nghe lại bất cứ lúc nào.
            </h1>
            <p className="mt-2 text-sm leading-6 text-indigo-100 sm:text-base">
              Quản lý từ tiếng Anh, nghĩa tiếng Việt và phát âm trong cùng một nơi.
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="relative shrink-0 !bg-white !bg-none !text-indigo-700 shadow-white/10 hover:!bg-indigo-50"
          >
            <Plus className="h-4 w-4" />
            Thêm từ mới
          </Button>
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: LibraryBig,
            label: "Tổng từ vựng",
            value: vocabularyQuery.isLoading ? "—" : data?.total ?? 0,
            color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
          },
          {
            icon: Headphones,
            label: "Có audio trên trang",
            value: vocabularyQuery.isLoading ? "—" : audioCount,
            color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
          },
          {
            icon: Database,
            label: "Lưu trữ",
            value: "Đã đồng bộ",
            color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
          },
        ].map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border border-white bg-white/90 p-4 shadow-sm shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none"
          >
            <span className={`grid h-11 w-11 place-items-center rounded-2xl ${color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-[24px] border border-white bg-white/95 shadow-xl shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-none">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Danh sách từ vựng
            </h2>
            <p className="mt-1 text-xs text-slate-500">Từ mới nhất được hiển thị trước.</p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="vocabulary-search"
              name="vocabularySearch"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tìm tiếng Anh hoặc tiếng Việt…"
              aria-label="Tìm từ vựng"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-900"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {vocabularyQuery.isError ? (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
              <RefreshCw className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-extrabold text-slate-900 dark:text-white">
              Không thể tải danh sách
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Kiểm tra kết nối tới API và MySQL, sau đó thử lại.
            </p>
            <Button
              variant="secondary"
              className="mt-5"
              onClick={() => vocabularyQuery.refetch()}
            >
              <RefreshCw className="h-4 w-4" /> Thử lại
            </Button>
          </div>
        ) : (
          <VocabularyList
            items={data?.items ?? []}
            loading={vocabularyQuery.isLoading}
            search={search}
            activeAudioId={activeAudioId}
            onActivateAudio={setActiveAudioId}
            onEdit={openEdit}
            onDelete={setPendingDelete}
            onAdd={openCreate}
          />
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={data?.total ?? 0}
          onPageChange={(nextPage) => {
            setPage(nextPage);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </section>

      {formOpen && (
        <VocabularyFormModal
          key={editing?.id ?? "new"}
          vocabulary={editing}
          loading={saveMutation.isPending}
          onSubmit={handleSave}
          onClose={() => {
            if (saveMutation.isPending) return;
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Xóa từ vựng?"
        description={`“${pendingDelete?.english_word ?? "Từ này"}” và audio đi kèm sẽ bị xóa. Thao tác này không thể hoàn tác.`}
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onClose={() => {
          if (!deleteMutation.isPending) setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}
