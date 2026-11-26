import { Headphones } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 text-white shadow-lg shadow-indigo-600/20">
        <Headphones className="h-5 w-5" strokeWidth={2.4} />
        <span className="absolute -bottom-2 -right-2 h-5 w-5 rounded-full bg-white/25" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold tracking-tight text-slate-950 sm:text-base dark:text-white">
            TOEIC Vocabulary
          </p>
          <p className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500 min-[390px]:block">
            Listen · Learn · Remember
          </p>
        </div>
      )}
    </div>
  );
}
