import { AudioLines, LoaderCircle } from "lucide-react";

type NowPlayingPanelProps = {
  playing: boolean;
  preparing: boolean;
  english?: string;
  vietnamese?: string;
  current?: number;
  total?: number;
  continuous: boolean;
};

export function NowPlayingPanel({
  playing,
  preparing,
  english,
  vietnamese,
  current,
  total,
  continuous,
}: NowPlayingPanelProps) {
  return (
    <div
      className="min-h-32 rounded-2xl border border-white/20 bg-white/10 p-4 shadow-inner shadow-white/5 backdrop-blur-sm"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan-100">
        <span className="inline-flex items-center gap-2">
          {preparing ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <AudioLines className={`h-4 w-4 ${playing ? "animate-pulse" : ""}`} />
          )}
          {preparing ? "Đang chuẩn bị" : playing ? "Đang đọc" : "Sẵn sàng luyện nghe"}
        </span>
        {playing && current && total ? (
          <span className="rounded-full bg-white/10 px-2.5 py-1 tracking-normal text-white">
            {current}/{total}
          </span>
        ) : null}
      </div>

      {playing && english ? (
        <div className="mt-3 min-w-0">
          <p className="truncate text-xl font-extrabold text-white" title={english}>
            {english}
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-indigo-100" title={vietnamese}>
            {vietnamese || "Chưa có nghĩa tiếng Việt"}
          </p>
          {continuous && (
            <p className="mt-2 text-[11px] font-semibold text-cyan-200">
              Phát liên tục cho đến khi bạn bấm dừng
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-indigo-100">
          Từ tiếng Anh và nghĩa tiếng Việt đang đọc sẽ hiển thị tại đây.
        </p>
      )}
    </div>
  );
}
