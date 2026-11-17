import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CircleDashed,
  Headphones,
  Languages,
  LibraryBig,
  ListMusic,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Square,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Pagination } from "../components/vocabulary/Pagination";
import { AddVocabularyButton } from "../components/vocabulary/AddVocabularyButton";
import { NowPlayingPanel } from "../components/vocabulary/NowPlayingPanel";
import { VocabularyFormModal } from "../components/vocabulary/VocabularyFormModal";
import { VocabularyList } from "../components/vocabulary/VocabularyList";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { useVocabularies } from "../hooks/useVocabularies";
import {
  createVocabulary,
  deleteVocabulary,
  getAudioUrl,
  getWordMeaningAudioUrl,
  hasDuplicateVocabulary,
  listAllVocabularies,
  setVocabularyMastery,
  updateVocabulary,
} from "../services/vocabulary.service";
import type {
  MasteryLevel,
  Vocabulary,
  VocabularyFormValues,
  VocabularyStatus,
} from "../types/vocabulary";
import { toUserMessage } from "../utils/errors";
import { PAGE_SIZE } from "../utils/validation";

type PlaylistTrack = {
  activationId: string;
  vocabularyId: string;
  kind: "word" | "example" | "meaning";
  hasStoredAudio?: boolean;
  label: string;
  english: string;
  vietnamese: string;
};

type PlaylistMode = "word-example" | "word-meaning";

type PlaylistProgress = {
  current: number;
  total: number;
  label: string;
  english: string;
  vietnamese: string;
  repetition: number;
  repetitionTotal: number;
};

type PlaybackRate = 0.5 | 0.75 | 1 | 1.5;

const NEXT_MASTERY_LEVEL: Record<MasteryLevel, MasteryLevel> = {
  unlearned: "learning",
  learning: "mastered",
  mastered: "unlearned",
};

const MASTERY_LABELS: Record<MasteryLevel, string> = {
  unlearned: "Chưa thuộc",
  learning: "Thuộc sơ sơ",
  mastered: "Thuộc kĩ",
};

export default function VocabularyPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<VocabularyStatus>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vocabulary | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Vocabulary | null>(null);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [playlistPreparing, setPlaylistPreparing] = useState(false);
  const [playlistPlaying, setPlaylistPlaying] = useState(false);
  const [playlistMode, setPlaylistMode] = useState<PlaylistMode | null>(null);
  const [playlistProgress, setPlaylistProgress] = useState<PlaylistProgress | null>(null);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);
  const [repeatCount, setRepeatCount] = useState(1);
  const playlistAudioRef = useRef<HTMLAudioElement | null>(null);
  const playlistUrlRef = useRef<string | null>(null);
  const playlistTracksRef = useRef<PlaylistTrack[]>([]);
  const playlistRunRef = useRef(0);
  const playlistSkippedRef = useRef(0);
  const playlistDelayRef = useRef<number | null>(null);
  const playlistModeRef = useRef<PlaylistMode | null>(null);
  const playlistCycleStartSkippedRef = useRef(0);
  const playlistUrlsRef = useRef(new Map<string, string>());

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const vocabularyQuery = useVocabularies(user?.id, search, page, status);
  const data = vocabularyQuery.data;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  function releasePlaylistAudio() {
    const audio = playlistAudioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    playlistUrlRef.current = null;
  }

  function clearPlaylistUrls() {
    playlistUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    playlistUrlsRef.current.clear();
  }

  function stopPlaylist(showMessage = false) {
    playlistRunRef.current += 1;
    if (playlistDelayRef.current !== null) {
      window.clearTimeout(playlistDelayRef.current);
      playlistDelayRef.current = null;
    }
    releasePlaylistAudio();
    clearPlaylistUrls();
    playlistTracksRef.current = [];
    setPlaylistPreparing(false);
    setPlaylistPlaying(false);
    setPlaylistMode(null);
    playlistModeRef.current = null;
    setPlaylistProgress(null);
    setActiveAudioId(null);
    playlistCycleStartSkippedRef.current = 0;
    if (showMessage) showToast("Đã dừng danh sách phát.", "info");
  }

  function finishPlaylist(runId: number) {
    if (runId !== playlistRunRef.current) return;
    const skipped = playlistSkippedRef.current;
    const finishedMode = playlistModeRef.current;
    if (playlistDelayRef.current !== null) {
      window.clearTimeout(playlistDelayRef.current);
      playlistDelayRef.current = null;
    }
    releasePlaylistAudio();
    clearPlaylistUrls();
    playlistTracksRef.current = [];
    setPlaylistPlaying(false);
    setPlaylistMode(null);
    playlistModeRef.current = null;
    setPlaylistProgress(null);
    setActiveAudioId(null);
    playlistCycleStartSkippedRef.current = 0;
    showToast(
      skipped > 0
        ? `Đã nghe xong. Có ${skipped} audio không thể phát và đã được bỏ qua.`
        : finishedMode === "word-meaning"
          ? "Đã phát xong toàn bộ từ vựng và nghĩa tiếng Việt."
          : "Đã phát xong toàn bộ từ vựng và ví dụ.",
      skipped > 0 ? "info" : "success",
    );
    if (finishedMode === "word-meaning") {
      void queryClient.invalidateQueries({ queryKey: ["vocabularies", user?.id] });
    }
  }

  async function playPlaylistTrack(index: number, runId: number): Promise<void> {
    if (runId !== playlistRunRef.current) return;
    const tracks = playlistTracksRef.current;
    if (index >= tracks.length) {
      if (playlistModeRef.current === "word-meaning" && tracks.length > 0) {
        const failedThisCycle =
          playlistSkippedRef.current - playlistCycleStartSkippedRef.current;
        if (failedThisCycle < tracks.length) {
          playlistCycleStartSkippedRef.current = playlistSkippedRef.current;
          void playPlaylistTrack(0, runId);
          return;
        }
      }
      finishPlaylist(runId);
      return;
    }

    const track = tracks[index];
    setPlaylistProgress({
      current: index + 1,
      total: tracks.length,
      label: track.label,
      english: track.english,
      vietnamese: track.vietnamese,
      repetition: 1,
      repetitionTotal: repeatCount,
    });

    let advanced = false;
    try {
      let url = playlistUrlsRef.current.get(track.activationId);
      if (!url) {
        url =
          track.kind === "meaning"
            ? await getWordMeaningAudioUrl(
                track.vocabularyId,
                !track.hasStoredAudio,
              )
            : await getAudioUrl(track.vocabularyId, track.kind);
        if (runId !== playlistRunRef.current) {
          URL.revokeObjectURL(url);
          return;
        }
        if (track.kind === "meaning") track.hasStoredAudio = true;
        playlistUrlsRef.current.set(track.activationId, url);
      }
      if (runId !== playlistRunRef.current) {
        return;
      }

      releasePlaylistAudio();
      playlistUrlRef.current = url;
      const audio = playlistAudioRef.current ?? new Audio();
      playlistAudioRef.current = audio;
      audio.preload = "auto";
      audio.src = url;
      audio.playbackRate = playbackRate;
      setActiveAudioId(track.activationId);

      let completedRepetitions = 0;
      const advance = (failed: boolean) => {
        if (advanced || runId !== playlistRunRef.current) return;
        advanced = true;
        if (failed) playlistSkippedRef.current += 1;
        const nextTrack = tracks[index + 1];
        const shouldPauseBeforeExample =
          !failed &&
          track.kind === "word" &&
          nextTrack?.kind === "example" &&
          nextTrack.vocabularyId === track.vocabularyId;
        const shouldPauseBeforeNextMeaning = !failed && track.kind === "meaning";

        if (shouldPauseBeforeExample) {
          setActiveAudioId(null);
          setPlaylistProgress({
            current: index + 1,
            total: tracks.length,
            label: `${track.label.split(" · ")[0]} · nghỉ 1 giây trước ví dụ`,
            english: track.english,
            vietnamese: track.vietnamese,
            repetition: repeatCount,
            repetitionTotal: repeatCount,
          });
          playlistDelayRef.current = window.setTimeout(() => {
            playlistDelayRef.current = null;
            void playPlaylistTrack(index + 1, runId);
          }, 1_000);
          return;
        }
        if (shouldPauseBeforeNextMeaning) {
          setActiveAudioId(null);
          setPlaylistProgress({
            current: index + 1,
            total: tracks.length,
            label: `${track.english} · nghỉ 1,5 giây trước từ tiếp theo`,
            english: track.english,
            vietnamese: track.vietnamese,
            repetition: repeatCount,
            repetitionTotal: repeatCount,
          });
          playlistDelayRef.current = window.setTimeout(() => {
            playlistDelayRef.current = null;
            void playPlaylistTrack(index + 1, runId);
          }, 1_500);
          return;
        }
        void playPlaylistTrack(index + 1, runId);
      };
      audio.onended = () => {
        completedRepetitions += 1;
        if (completedRepetitions < repeatCount) {
          setPlaylistProgress({
            current: index + 1,
            total: tracks.length,
            label: track.label,
            english: track.english,
            vietnamese: track.vietnamese,
            repetition: completedRepetitions + 1,
            repetitionTotal: repeatCount,
          });
          audio.currentTime = 0;
          void audio.play().catch(() => advance(true));
          return;
        }
        advance(false);
      };
      audio.onerror = () => advance(true);
      await audio.play();
    } catch {
      if (advanced || runId !== playlistRunRef.current) return;
      advanced = true;
      playlistSkippedRef.current += 1;
      await playPlaylistTrack(index + 1, runId);
    }
  }

  async function startPlaylist(mode: PlaylistMode) {
    if (playlistPlaying || playlistPreparing) {
      stopPlaylist(true);
      return;
    }
    if (!user) return;

    const runId = playlistRunRef.current + 1;
    playlistRunRef.current = runId;
    setPlaylistPreparing(true);
    setPlaylistMode(mode);
    playlistModeRef.current = mode;
    setActiveAudioId(null);
    playlistSkippedRef.current = 0;
    playlistCycleStartSkippedRef.current = 0;
    clearPlaylistUrls();

    try {
      const vocabularies = await listAllVocabularies(user.id, search, status);
      if (runId !== playlistRunRef.current) return;
      const tracks = vocabularies.flatMap<PlaylistTrack>((item) => {
        if (mode === "word-meaning") {
          return [
            {
              activationId: `${item.id}:meaning`,
              vocabularyId: item.id,
              kind: "meaning",
              hasStoredAudio: Boolean(item.word_meaning_audio_path),
              label: `${item.english_word} · từ và nghĩa`,
              english: item.english_word,
              vietnamese: item.vietnamese_meaning,
            },
          ];
        }
        if (!item.audio_path || !item.example_audio_path) return [];
        return [
          {
            activationId: item.id,
            vocabularyId: item.id,
            kind: "word",
            label: `${item.english_word} · từ vựng`,
            english: item.english_word,
            vietnamese: item.vietnamese_meaning,
          },
          {
            activationId: `${item.id}:example`,
            vocabularyId: item.id,
            kind: "example",
            label: `${item.english_word} · ví dụ`,
            english: item.example_english || item.english_word,
            vietnamese: item.example_vietnamese || item.vietnamese_meaning,
          },
        ];
      });

      if (!tracks.length) {
        setPlaylistPreparing(false);
        setPlaylistMode(null);
        playlistModeRef.current = null;
        showToast(
          mode === "word-meaning"
            ? "Danh sách hiện tại chưa có từ vựng để phát."
            : "Chưa có từ nào có đủ audio từ vựng và audio ví dụ để phát.",
          "info",
        );
        return;
      }

      playlistTracksRef.current = tracks;
      setPlaylistPreparing(false);
      setPlaylistPlaying(true);
      void playPlaylistTrack(0, runId);
    } catch (error) {
      if (runId !== playlistRunRef.current) return;
      setPlaylistPreparing(false);
      setPlaylistMode(null);
      playlistModeRef.current = null;
      showToast(toUserMessage(error, "Không thể tạo danh sách phát."), "error");
    }
  }

  function handleManualAudioActivation(id: string | null) {
    stopPlaylist(false);
    setActiveAudioId(id);
  }

  useEffect(
    () => () => {
      playlistRunRef.current += 1;
      const audio = playlistAudioRef.current;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
      }
      if (playlistDelayRef.current !== null) {
        window.clearTimeout(playlistDelayRef.current);
      }
      if (playlistUrlRef.current) URL.revokeObjectURL(playlistUrlRef.current);
      clearPlaylistUrls();
    },
    [],
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

  const masteryMutation = useMutation({
    mutationFn: async (vocabulary: Vocabulary) =>
      setVocabularyMastery(
        vocabulary.id,
        NEXT_MASTERY_LEVEL[vocabulary.mastery_level],
      ),
  });

  function changeStatus(nextStatus: VocabularyStatus) {
    if (nextStatus === status) return;
    stopPlaylist(false);
    setStatus(nextStatus);
    setPage(1);
  }

  async function handleCycleMastery(vocabulary: Vocabulary) {
    stopPlaylist(false);
    try {
      const updated = await masteryMutation.mutateAsync(vocabulary);
      if ((data?.items.length ?? 0) === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      await queryClient.invalidateQueries({ queryKey: ["vocabularies", user?.id] });
      showToast(
        `Đã chuyển “${updated.english_word}” sang mức ${MASTERY_LABELS[updated.mastery_level].toLowerCase()}.`,
        "success",
      );
    } catch (error) {
      showToast(toUserMessage(error, "Không thể cập nhật trạng thái từ vựng."), "error");
    }
  }

  function openCreate() {
    stopPlaylist(false);
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(vocabulary: Vocabulary) {
    stopPlaylist(false);
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
    stopPlaylist(false);
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
        <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] lg:items-stretch">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10 bg-white/10 blur-2xl" />
          <div className="relative">
            <NowPlayingPanel
              playing={playlistPlaying}
              preparing={playlistPreparing}
              english={playlistProgress?.english}
              vietnamese={playlistProgress?.vietnamese}
              current={playlistProgress?.current}
              total={playlistProgress?.total}
              continuous={playlistMode === "word-meaning"}
            />
          </div>
          <div className="relative flex items-center">
            <AddVocabularyButton onClick={openCreate} />
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => changeStatus("all")}
          className={`flex items-center gap-4 rounded-2xl border p-4 text-left shadow-sm backdrop-blur transition ${
            status === "all"
              ? "border-indigo-300 bg-indigo-50 ring-4 ring-indigo-500/10 dark:border-indigo-800 dark:bg-indigo-950/40"
              : "border-white bg-white/90 hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-indigo-900"
          }`}
          aria-pressed={status === "all"}
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            <LibraryBig className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">Tổng từ vựng</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
              {vocabularyQuery.isLoading
                ? "—"
                : (data?.stats.unlearned ?? 0) +
                  (data?.stats.learning ?? 0) +
                  (data?.stats.mastered ?? 0)}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => changeStatus("unlearned")}
          className={`flex items-center gap-4 rounded-2xl border p-4 text-left shadow-sm backdrop-blur transition ${
            status === "unlearned"
              ? "border-cyan-300 bg-cyan-50 ring-4 ring-cyan-500/10 dark:border-cyan-800 dark:bg-cyan-950/40"
              : "border-white bg-white/90 hover:border-cyan-200 hover:bg-cyan-50/50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-cyan-900"
          }`}
          aria-pressed={status === "unlearned"}
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
            <CircleDashed className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">Chưa thuộc</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
              {vocabularyQuery.isLoading ? "—" : data?.stats.unlearned ?? 0}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => changeStatus("learning")}
          className={`flex items-center gap-4 rounded-2xl border p-4 text-left shadow-sm backdrop-blur transition ${
            status === "learning"
              ? "border-violet-300 bg-violet-50 ring-4 ring-violet-500/10 dark:border-violet-800 dark:bg-violet-950/40"
              : "border-white bg-white/90 hover:border-violet-200 hover:bg-violet-50/50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-violet-900"
          }`}
          aria-pressed={status === "learning"}
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">Thuộc sơ sơ</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
              {vocabularyQuery.isLoading ? "—" : data?.stats.learning ?? 0}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => changeStatus("mastered")}
          className={`flex items-center gap-4 rounded-2xl border p-4 text-left shadow-sm backdrop-blur transition ${
            status === "mastered"
              ? "border-amber-300 bg-amber-50 ring-4 ring-amber-500/10 dark:border-amber-800 dark:bg-amber-950/40"
              : "border-white bg-white/90 hover:border-amber-200 hover:bg-amber-50/50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-amber-900"
          }`}
          aria-pressed={status === "mastered"}
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300">
            <Star className="h-5 w-5 fill-current" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">Thuộc kĩ</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
              {vocabularyQuery.isLoading ? "—" : data?.stats.mastered ?? 0}
            </p>
          </div>
        </button>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-white bg-white/95 shadow-xl shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-none">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Danh sách từ vựng
            </h2>
            <p className="mt-1 text-xs text-slate-500">Từ mới nhất được hiển thị trước.</p>
          </div>
          <div className="flex w-full flex-col gap-3 lg:max-w-6xl lg:flex-row lg:items-center lg:justify-end">
            <div className="flex shrink-0 items-center gap-2">
              <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                Tốc độ
                <select
                  value={playbackRate}
                  disabled={playlistPlaying || playlistPreparing}
                  onChange={(event) =>
                    setPlaybackRate(Number(event.target.value) as PlaybackRate)
                  }
                  className="bg-transparent font-bold text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-white"
                  aria-label="Tốc độ phát danh sách"
                >
                  <option value={0.5}>x0.5</option>
                  <option value={0.75}>x0.75</option>
                  <option value={1}>x1</option>
                  <option value={1.5}>x1.5</option>
                </select>
              </label>
              <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                Lặp
                <select
                  value={repeatCount}
                  disabled={playlistPlaying || playlistPreparing}
                  onChange={(event) => setRepeatCount(Number(event.target.value))}
                  className="bg-transparent font-bold text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-white"
                  aria-label="Số lần phát mỗi audio"
                >
                  {[1, 2, 3, 5].map((count) => (
                    <option key={count} value={count}>
                      {count} lần
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={
                  playlistPlaying && playlistMode === "word-example"
                    ? "danger"
                    : "secondary"
                }
                loading={playlistPreparing && playlistMode === "word-example"}
                disabled={
                  (!playlistPlaying && !playlistPreparing && (data?.total ?? 0) === 0) ||
                  ((playlistPlaying || playlistPreparing) && playlistMode !== "word-example")
                }
                onClick={() => void startPlaylist("word-example")}
                className="shrink-0"
              >
                {playlistPlaying && playlistMode === "word-example" ? (
                  <Square className="h-4 w-4 fill-current" />
                ) : (
                  <ListMusic className="h-4 w-4" />
                )}
                {playlistPlaying && playlistMode === "word-example"
                  ? `Dừng (${playlistProgress?.current ?? 0}/${playlistProgress?.total ?? 0})`
                  : "Nghe tất cả"}
              </Button>
              <Button
                type="button"
                variant={
                  playlistPlaying && playlistMode === "word-meaning"
                    ? "danger"
                    : "secondary"
                }
                loading={playlistPreparing && playlistMode === "word-meaning"}
                disabled={
                  (!playlistPlaying && !playlistPreparing && (data?.total ?? 0) === 0) ||
                  ((playlistPlaying || playlistPreparing) && playlistMode !== "word-meaning")
                }
                onClick={() => void startPlaylist("word-meaning")}
                className="shrink-0 border-cyan-200 text-cyan-700 dark:border-cyan-900 dark:text-cyan-300"
              >
                {playlistPlaying && playlistMode === "word-meaning" ? (
                  <Square className="h-4 w-4 fill-current" />
                ) : (
                  <Languages className="h-4 w-4" />
                )}
                {playlistPlaying && playlistMode === "word-meaning"
                  ? `Dừng (${playlistProgress?.current ?? 0}/${playlistProgress?.total ?? 0})`
                  : "Nghe từ + nghĩa"}
              </Button>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="vocabulary-search"
                name="vocabularySearch"
                type="search"
                value={searchInput}
                onChange={(event) => {
                  stopPlaylist(false);
                  setSearchInput(event.target.value);
                }}
                placeholder="Tìm tiếng Anh hoặc tiếng Việt…"
                aria-label="Tìm từ vựng"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-900"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    stopPlaylist(false);
                    setSearchInput("");
                  }}
                  className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  aria-label="Xóa từ khóa tìm kiếm"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {playlistPlaying && playlistProgress && (
          <div
            className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50 px-4 py-2.5 text-xs font-semibold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 sm:px-6"
            aria-live="polite"
          >
            <Headphones className="h-4 w-4 animate-pulse" />
            Đang phát {playlistProgress.current}/{playlistProgress.total}: {playlistProgress.label}
            {playlistProgress.repetitionTotal > 1 &&
              ` · lần ${playlistProgress.repetition}/${playlistProgress.repetitionTotal}`}
          </div>
        )}

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
          <div
            key={`${status}:${search}:${page}`}
            className="max-h-[70vh] overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
          >
            <VocabularyList
              items={data?.items ?? []}
              loading={vocabularyQuery.isLoading}
              search={search}
              status={status}
              activeAudioId={activeAudioId}
              playlistPlaying={playlistPlaying}
              onActivateAudio={handleManualAudioActivation}
              onEdit={openEdit}
              onDelete={setPendingDelete}
              onCycleMastery={(vocabulary) => void handleCycleMastery(vocabulary)}
              masteryUpdatingId={
                masteryMutation.isPending ? masteryMutation.variables?.id ?? null : null
              }
              onAdd={openCreate}
            />
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={data?.total ?? 0}
          onPageChange={(nextPage) => {
            stopPlaylist(false);
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
