import { Headphones } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
      <div className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 text-white shadow-lg shadow-indigo-600/20 sm:h-11 sm:w-11 sm:rounded-2xl">
        <Headphones className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.4} />
        <span className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full bg-white/25 sm:h-5 sm:w-5" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold tracking-tight text-slate-950 sm:text-base dark:text-white">
            TOEIC Vocabulary
          </p>
          <p className="hidden truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500 sm:block">
            Listen · Learn · Remember
          </p>
        </div>
      )}
    </div>
  );
}
