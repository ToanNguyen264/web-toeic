import { AlertCircle, Headphones, LoaderCircle, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getAudioUrl } from "../../services/vocabulary.service";

type AudioButtonProps = {
  id: string;
  path: string | null;
  name: string | null;
  isActive: boolean;
  onActivate: (id: string | null) => void;
  compact?: boolean;
  kind?: "word" | "example";
};

export function AudioButton({
  id,
  path,
  name,
  isActive,
  onActivate,
  compact = false,
  kind = "word",
}: AudioButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isActive && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  }, [isActive]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  if (!path) {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Headphones className="h-4 w-4" />
        Chưa có audio
      </span>
    );
  }

  async function toggleAudio() {
    try {
      setFailed(false);
      if (playing && audioRef.current) {
        audioRef.current.pause();
        setPlaying(false);
        onActivate(null);
        return;
      }

      setLoading(true);
      let url = audioUrl;
      if (!url) {
        url = await getAudioUrl(id, kind);
        setAudioUrl(url);
      }

      const activationId = kind === "example" ? `${id}:example` : id;
      onActivate(activationId);
      if (!audioRef.current) {
        audioRef.current = new Audio(url);
        audioRef.current.preload = "metadata";
        audioRef.current.addEventListener("ended", () => {
          setPlaying(false);
          onActivate(null);
        });
        audioRef.current.addEventListener("error", () => {
          setPlaying(false);
          setFailed(true);
          onActivate(null);
        });
      } else {
        audioRef.current.src = url;
      }
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      setFailed(true);
      setPlaying(false);
      onActivate(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={toggleAudio}
        disabled={loading}
        className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 disabled:opacity-60 ${
          playing
            ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
            : failed
              ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950"
              : "border-indigo-100 bg-indigo-50 text-indigo-700 hover:border-indigo-200 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
        } ${compact ? "h-10 w-10" : "min-h-10 px-3 text-xs"}`}
        aria-label={playing ? `Tạm dừng ${name}` : `Phát ${name}`}
        title={failed ? "Không thể phát audio" : name || "Phát audio"}
      >
        {loading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : failed ? (
          <AlertCircle className="h-4 w-4" />
        ) : playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current" />
        )}
        {!compact && (playing ? "Tạm dừng" : failed ? "Thử lại" : "Nghe")}
      </button>
      {!compact && name && (
        <span className="max-w-32 truncate text-xs text-slate-500" title={name}>
          {name}
        </span>
      )}
    </div>
  );
}
