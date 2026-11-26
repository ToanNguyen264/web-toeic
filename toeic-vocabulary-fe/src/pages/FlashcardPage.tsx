import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Headphones, Inbox, Layers, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { FlashcardCard } from "../components/flashcard/FlashcardCard";
import { FlashcardControls } from "../components/flashcard/FlashcardControls";
import { FlashcardSummary } from "../components/flashcard/FlashcardSummary";
import {
  FlashcardToolbar,
  type DeckSize,
} from "../components/flashcard/FlashcardToolbar";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { useFlashcardPool } from "../hooks/useFlashcardPool";
import { useToast } from "../hooks/useToast";
import { getAudioUrl, reviewVocabulary } from "../services/vocabulary.service";
import type {
  MasteryLevel,
  Vocabulary,
  VocabularyStatus,
} from "../types/vocabulary";
import { toUserMessage } from "../utils/errors";

const AUTOPLAY_STORAGE_KEY = "toeic_flashcard_autoplay";

function readInitialAutoPlay() {
  try {
    return window.localStorage.getItem(AUTOPLAY_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  if (seed <= 0 || result.length <= 1) return result;
  let state = (seed * 2654435761) >>> 0;
  for (let i = result.length - 1; i > 0; i -= 1) {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const randomFloat = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(randomFloat * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function FlashcardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<VocabularyStatus>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [deckSize, setDeckSize] = useState<DeckSize>(20);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [roundSeed, setRoundSeed] = useState(0);
  const [autoPlay, setAutoPlay] = useState(readInitialAutoPlay);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [reviewSubsetIds, setReviewSubsetIds] = useState<string[] | null>(null);
  const [cardOverrides, setCardOverrides] = useState<Record<string, Vocabulary>>({});
  const [sessionGrades, setSessionGrades] = useState<Record<string, MasteryLevel>>({});
  const [statsDelta, setStatsDelta] = useState({
    unlearned: 0,
    learning: 0,
    mastered: 0,
  });

  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [loadingAudioKey, setLoadingAudioKey] = useState<string | null>(null);
  const [failedAudioKey, setFailedAudioKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef(new Map<string, string>());
  const audioRunRef = useRef(0);

  function stopAudio() {
    audioRunRef.current += 1;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
    }
    setPlayingAudioKey(null);
    setLoadingAudioKey(null);
    setFailedAudioKey(null);
  }

  function resetSessionCursor(clearGrades = true) {
    stopAudio();
    setCurrentIndex(0);
    setFlipped(false);
    setExampleOpen(false);
    setCompleted(false);
    if (clearGrades) {
      setSessionGrades({});
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next !== search) {
        stopAudio();
        setSearch(next);
        setCurrentIndex(0);
        setFlipped(false);
        setExampleOpen(false);
        setCompleted(false);
        setReviewSubsetIds(null);
        setCardOverrides({});
        setSessionGrades({});
        setStatsDelta({ unlearned: 0, learning: 0, mastered: 0 });
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput, search]);

  useEffect(() => {
    const cache = audioCacheRef.current;
    return () => {
      audioRunRef.current += 1;
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  const poolQuery = useFlashcardPool(user?.id, search, status, roundSeed);

  const liveStats = useMemo(() => {
    if (!poolQuery.data?.stats) return undefined;
    return {
      unlearned: Math.max(0, poolQuery.data.stats.unlearned + statsDelta.unlearned),
      learning: Math.max(0, poolQuery.data.stats.learning + statsDelta.learning),
      mastered: Math.max(0, poolQuery.data.stats.mastered + statsDelta.mastered),
    };
  }, [poolQuery.data?.stats, statsDelta]);

  const sessionDeck = useMemo(() => {
    const rawItems = poolQuery.data?.items ?? [];
    if (!rawItems.length) return [];
    const baseSlice = reviewSubsetIds
      ? rawItems.filter((item) => reviewSubsetIds.includes(item.id))
      : deckSize === "all"
        ? rawItems
        : rawItems.slice(0, deckSize);

    const ordered = shuffleEnabled
      ? seededShuffle(baseSlice, shuffleSeed || 1)
      : baseSlice;

    return ordered.map((item) => cardOverrides[item.id] ?? item);
  }, [
    poolQuery.data?.items,
    reviewSubsetIds,
    deckSize,
    shuffleEnabled,
    shuffleSeed,
    cardOverrides,
  ]);

  const safeIndex =
    sessionDeck.length > 0 ? Math.min(currentIndex, sessionDeck.length - 1) : 0;
  const currentCard = completed ? null : sessionDeck[safeIndex] ?? null;

  async function handlePlayAudio(kind: "word" | "example") {
    if (!currentCard) return;
    const hasPath =
      kind === "word"
        ? Boolean(currentCard.audio_path)
        : Boolean(currentCard.example_audio_path);
    if (!hasPath) return;

    const cardId = currentCard.id;
    const key = `${cardId}:${kind}`;
    if (playingAudioKey === key && audioRef.current) {
      stopAudio();
      return;
    }

    stopAudio();
    const runId = ++audioRunRef.current;
    setLoadingAudioKey(key);
    setFailedAudioKey(null);

    try {
      let url = audioCacheRef.current.get(key);
      if (!url) {
        url = await getAudioUrl(cardId, kind);
        if (runId !== audioRunRef.current) {
          URL.revokeObjectURL(url);
          return;
        }
        audioCacheRef.current.set(key, url);
      }
      if (runId !== audioRunRef.current) return;

      const audio = new Audio(url);
      audio.preload = "auto";
      audio.onended = () => {
        if (runId === audioRunRef.current) setPlayingAudioKey(null);
      };
      audio.onerror = () => {
        if (runId === audioRunRef.current) {
          setPlayingAudioKey(null);
          setFailedAudioKey(key);
        }
      };
      audioRef.current = audio;
      setLoadingAudioKey(null);
      await audio.play();
      if (runId === audioRunRef.current) {
        setPlayingAudioKey(key);
      }
    } catch {
      if (runId === audioRunRef.current) {
        setLoadingAudioKey(null);
        setFailedAudioKey(key);
        setPlayingAudioKey(null);
      }
    }
  }

  useEffect(() => {
    if (!autoPlay || completed || !currentCard?.audio_path) return;
    const cardId = currentCard.id;
    const key = `${cardId}:word`;
    const runId = ++audioRunRef.current;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
    }

    void (async () => {
      try {
        let url = audioCacheRef.current.get(key);
        if (!url) {
          url = await getAudioUrl(cardId, "word");
          if (runId !== audioRunRef.current) {
            URL.revokeObjectURL(url);
            return;
          }
          audioCacheRef.current.set(key, url);
        }
        if (runId !== audioRunRef.current) return;

        const audio = new Audio(url);
        audio.preload = "auto";
        audio.onended = () => {
          if (runId === audioRunRef.current) setPlayingAudioKey(null);
        };
        audio.onerror = () => {
          if (runId === audioRunRef.current) setPlayingAudioKey(null);
        };
        audioRef.current = audio;
        await audio.play();
        if (runId === audioRunRef.current) {
          setPlayingAudioKey(key);
        }
      } catch {
        if (runId === audioRunRef.current) {
          setPlayingAudioKey(null);
        }
      }
    })();

    return () => {
      audioRunRef.current += 1;
      audioRef.current?.pause();
    };
  }, [autoPlay, completed, currentCard?.id, currentCard?.audio_path]);

  const reviewMutation = useMutation({
    mutationFn: ({ id, masteryLevel }: { id: string; masteryLevel: MasteryLevel }) =>
      reviewVocabulary(id, masteryLevel),
  });

  function advanceAfterAction() {
    stopAudio();
    setFlipped(false);
    setExampleOpen(false);
    if (safeIndex + 1 >= sessionDeck.length) {
      setCompleted(true);
    } else {
      setCurrentIndex(safeIndex + 1);
    }
  }

  function handlePrev() {
    if (safeIndex <= 0) return;
    stopAudio();
    setFlipped(false);
    setExampleOpen(false);
    setCurrentIndex(safeIndex - 1);
  }

  function handleNext() {
    advanceAfterAction();
  }

  function handleFlip() {
    setFlipped((prev) => {
      if (prev) setExampleOpen(false);
      return !prev;
    });
  }

  async function handleRate(nextLevel: MasteryLevel) {
    if (!currentCard || reviewMutation.isPending) return;
    const targetCard = currentCard;
    const previousLevel = targetCard.mastery_level;
    const optimisticCard: Vocabulary = {
      ...targetCard,
      mastery_level: nextLevel,
      is_learned: nextLevel === "mastered",
      last_reviewed_at: new Date().toISOString(),
      review_count: targetCard.review_count + 1,
    };

    setCardOverrides((prev) => ({ ...prev, [targetCard.id]: optimisticCard }));
    setSessionGrades((prev) => ({ ...prev, [targetCard.id]: nextLevel }));
    if (previousLevel !== nextLevel) {
      setStatsDelta((prev) => ({
        ...prev,
        [previousLevel]: prev[previousLevel] - 1,
        [nextLevel]: prev[nextLevel] + 1,
      }));
    }

    advanceAfterAction();

    try {
      const saved = await reviewMutation.mutateAsync({
        id: targetCard.id,
        masteryLevel: nextLevel,
      });
      setCardOverrides((prev) => ({ ...prev, [saved.id]: saved }));
      void queryClient.invalidateQueries({ queryKey: ["vocabularies", user?.id] });
    } catch (error) {
      setCardOverrides((prev) => ({ ...prev, [targetCard.id]: targetCard }));
      if (previousLevel !== nextLevel) {
        setStatsDelta((prev) => ({
          ...prev,
          [previousLevel]: prev[previousLevel] + 1,
          [nextLevel]: prev[nextLevel] - 1,
        }));
      }
      showToast(
        toUserMessage(error, "Không thể lưu kết quả ôn tập. Vui lòng thử lại."),
        "error",
      );
    }
  }

  function handleStatusChange(nextStatus: VocabularyStatus) {
    if (nextStatus === status) return;
    setStatus(nextStatus);
    setReviewSubsetIds(null);
    setCardOverrides({});
    setStatsDelta({ unlearned: 0, learning: 0, mastered: 0 });
    resetSessionCursor(true);
  }

  function handleDeckSizeChange(nextSize: DeckSize) {
    setDeckSize(nextSize);
    setReviewSubsetIds(null);
    resetSessionCursor(true);
  }

  function handleToggleShuffle() {
    setShuffleEnabled((prev) => {
      const next = !prev;
      setShuffleSeed((seed) => (next ? seed + 1 : 0));
      return next;
    });
    resetSessionCursor(false);
  }

  function handleToggleAutoPlay() {
    setAutoPlay((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(AUTOPLAY_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors in restricted environments.
      }
      if (!next) stopAudio();
      return next;
    });
  }

  function startFreshPriorityBatch() {
    setReviewSubsetIds(null);
    setCardOverrides({});
    setStatsDelta({ unlearned: 0, learning: 0, mastered: 0 });
    if (shuffleEnabled) setShuffleSeed((seed) => seed + 1);
    setRoundSeed((seed) => seed + 1);
    resetSessionCursor(true);
  }

  function handleReviewWeakCards() {
    const weakIds = sessionDeck
      .filter((item) => {
        const graded = sessionGrades[item.id] ?? item.mastery_level;
        return graded !== "mastered";
      })
      .map((item) => item.id);
    if (!weakIds.length) return;
    setReviewSubsetIds(weakIds);
    if (shuffleEnabled) setShuffleSeed((seed) => seed + 1);
    resetSessionCursor(true);
  }

  function handleRestartSameDeck() {
    if (shuffleEnabled) setShuffleSeed((seed) => seed + 1);
    resetSessionCursor(true);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
          target.isContentEditable)
      ) {
        return;
      }
      if (completed || !currentCard) return;

      if (event.code === "Space") {
        event.preventDefault();
        handleFlip();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrev();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
        return;
      }
      if (event.key === "1") {
        event.preventDefault();
        void handleRate("unlearned");
        return;
      }
      if (event.key === "2") {
        event.preventDefault();
        void handleRate("learning");
        return;
      }
      if (event.key === "3") {
        event.preventDefault();
        void handleRate("mastered");
        return;
      }
      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        void handlePlayAudio("word");
        return;
      }
      if ((event.key === "e" || event.key === "E") && flipped && currentCard.example_english) {
        event.preventDefault();
        setExampleOpen((open) => !open);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const weakCount = useMemo(
    () =>
      sessionDeck.filter((item) => {
        const graded = sessionGrades[item.id] ?? item.mastery_level;
        return graded !== "mastered";
      }).length,
    [sessionDeck, sessionGrades],
  );

  const playingKind =
    currentCard && playingAudioKey === `${currentCard.id}:word`
      ? "word"
      : currentCard && playingAudioKey === `${currentCard.id}:example`
        ? "example"
        : null;
  const loadingKind =
    currentCard && loadingAudioKey === `${currentCard.id}:word`
      ? "word"
      : currentCard && loadingAudioKey === `${currentCard.id}:example`
        ? "example"
        : null;
  const failedKind =
    currentCard && failedAudioKey === `${currentCard.id}:word`
      ? "word"
      : currentCard && failedAudioKey === `${currentCard.id}:example`
        ? "example"
        : null;

  const progressPercent =
    sessionDeck.length > 0
      ? Math.round(((completed ? sessionDeck.length : safeIndex + 1) / sessionDeck.length) * 100)
      : 0;

  return (
    <AppShell>
      <FlashcardToolbar
        status={status}
        onStatusChange={handleStatusChange}
        stats={liveStats}
        statsLoading={poolQuery.isLoading}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        deckSize={deckSize}
        onDeckSizeChange={handleDeckSizeChange}
        shuffleEnabled={shuffleEnabled}
        onToggleShuffle={handleToggleShuffle}
        onReloadPool={startFreshPriorityBatch}
        autoPlay={autoPlay}
        onToggleAutoPlay={handleToggleAutoPlay}
      />

      {poolQuery.isLoading ? (
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-6 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-96 animate-pulse rounded-[28px] bg-white/90 shadow-sm dark:bg-slate-900" />
        </div>
      ) : poolQuery.isError ? (
        <div className="mx-auto flex min-h-80 max-w-xl flex-col items-center justify-center rounded-[28px] border border-white bg-white/95 px-6 py-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
            <RefreshCw className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-extrabold text-slate-900 dark:text-white">
            Không thể tải bộ thẻ Flashcard
          </h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Kiểm tra kết nối tới máy chủ và thử tải lại.
          </p>
          <Button
            variant="secondary"
            className="mt-5"
            onClick={() => void poolQuery.refetch()}
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </Button>
        </div>
      ) : sessionDeck.length === 0 ? (
        <div className="mx-auto flex min-h-80 max-w-xl flex-col items-center justify-center rounded-[28px] border border-white bg-white/95 px-6 py-14 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-indigo-50 text-indigo-500 dark:bg-indigo-950 dark:text-indigo-300">
            {search ? <Inbox className="h-7 w-7" /> : <Layers className="h-7 w-7" />}
          </div>
          <h3 className="mt-5 text-lg font-extrabold text-slate-900 dark:text-white">
            {search
              ? "Không tìm thấy thẻ phù hợp"
              : status !== "all"
                ? "Nhóm này hiện chưa có từ vựng"
                : "Kho từ vựng đang trống"}
          </h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
            {search
              ? "Thử từ khóa khác hoặc xóa ô tìm kiếm để quay lại bộ thẻ."
              : status !== "all"
                ? "Hãy chọn nhóm Tất cả từ hoặc chuyển sang chế độ Nghe để thêm từ mới."
                : "Hãy sang mục Nghe để thêm từ vựng, ví dụ và audio trước khi bắt đầu lật thẻ."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {(search || status !== "all") && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  handleStatusChange("all");
                }}
              >
                Xem tất cả từ
              </Button>
            )}
            <Link
              to="/listen"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
            >
              <Headphones className="h-4 w-4" />
              Mở mục Nghe
            </Link>
          </div>
        </div>
      ) : completed ? (
        <FlashcardSummary
          totalCards={sessionDeck.length}
          sessionGrades={sessionGrades}
          weakCount={weakCount}
          onNextPriorityBatch={startFreshPriorityBatch}
          onReviewWeakCards={handleReviewWeakCards}
          onRestartSameDeck={handleRestartSameDeck}
        />
      ) : currentCard ? (
        <div>
          <div className="mx-auto mb-4 max-w-3xl">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>
                Thẻ {safeIndex + 1} / {sessionDeck.length}
                {reviewSubsetIds ? " · Ôn lại từ chưa vững" : " · Ưu tiên từ lâu chưa ôn"}
              </span>
              <span>
                Đã chấm {Object.keys(sessionGrades).length}/{sessionDeck.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <FlashcardCard
            card={currentCard}
            flipped={flipped}
            onFlip={handleFlip}
            exampleOpen={exampleOpen}
            onToggleExample={() => setExampleOpen((prev) => !prev)}
            playingKind={playingKind}
            loadingKind={loadingKind}
            failedKind={failedKind}
            onPlayAudio={(kind) => void handlePlayAudio(kind)}
            sessionGrade={sessionGrades[currentCard.id]}
          />

          <FlashcardControls
            canPrev={safeIndex > 0}
            isLastCard={safeIndex + 1 >= sessionDeck.length}
            flipped={flipped}
            currentMastery={currentCard.mastery_level}
            ratingLoadingLevel={
              reviewMutation.isPending ? reviewMutation.variables?.masteryLevel ?? null : null
            }
            onPrev={handlePrev}
            onFlip={handleFlip}
            onNext={handleNext}
            onRate={(level) => void handleRate(level)}
          />
        </div>
      ) : null}
    </AppShell>
  );
}
