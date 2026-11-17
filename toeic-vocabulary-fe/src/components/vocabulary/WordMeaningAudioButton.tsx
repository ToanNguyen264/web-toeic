import { AlertCircle, Languages, LoaderCircle, Pause } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getWordMeaningAudioUrl } from "../../services/vocabulary.service";

type WordMeaningAudioButtonProps = {
  id: string;
  english: string;
  path: string | null;
  isActive: boolean;
  onActivate: (id: string | null) => void;
};

export function WordMeaningAudioButton({
  id,
  english,
  path,
  isActive,
  onActivate,
}: WordMeaningAudioButtonProps) {
  const activationId = `${id}:meaning`;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stored, setStored] = useState(Boolean(path));

  useEffect(() => {
    if (!isActive && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current?.removeAttribute("src");
      audioRef.current?.load();
      audioRef.current = null;
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    };
  }, [id, path]);

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
      let url = audioUrlRef.current;
      if (!url) {
        url = await getWordMeaningAudioUrl(id, !stored);
        audioUrlRef.current = url;
        setStored(true);
      }

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
    <button
      type="button"
      onClick={toggleAudio}
      disabled={loading}
      className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/20 disabled:cursor-wait disabled:opacity-60 ${
        playing
          ? "border-cyan-600 bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
          : failed
            ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950"
            : "border-cyan-100 bg-cyan-50 text-cyan-700 hover:border-cyan-200 hover:bg-cyan-100 dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-300"
      }`}
      aria-label={playing ? `Dừng đọc ${english} và nghĩa` : `Đọc ${english} và nghĩa tiếng Việt`}
      title={
        failed
          ? "Không thể tạo hoặc phát audio từ và nghĩa"
          : stored
            ? "Phát audio từ và nghĩa đã lưu"
            : "Tạo và lưu audio: tiếng Anh, nghỉ 1 giây rồi đọc nghĩa tiếng Việt"
      }
    >
      {loading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : failed ? (
        <AlertCircle className="h-4 w-4" />
      ) : playing ? (
        <Pause className="h-4 w-4 fill-current" />
      ) : (
        <Languages className="h-4 w-4" />
      )}
      {playing ? "Dừng" : failed ? "Thử lại" : "Từ + nghĩa"}
    </button>
  );
}
