import { BookOpenText, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { toUserMessage } from "../../utils/errors";
import { BrandMark } from "../ui/BrandMark";
import { ThemeToggle } from "../ui/ThemeToggle";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { showToast } = useToast();

  async function handleSignOut() {
    try {
      await signOut();
      showToast("Bạn đã đăng xuất.", "info");
    } catch (error) {
      showToast(toUserMessage(error, "Không thể đăng xuất."), "error");
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f7fc] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 dashboard-grid opacity-50 dark:opacity-15" />
      <header className="sticky top-0 z-30 border-b border-white/80 bg-white/80 shadow-sm shadow-slate-200/30 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80 dark:shadow-none">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <BrandMark />
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex dark:border-slate-800 dark:bg-slate-900">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                <BookOpenText className="h-4 w-4" />
              </div>
              <span className="max-w-44 truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
                {user?.email}
              </span>
            </div>
            <ThemeToggle />
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-rose-900 dark:hover:bg-rose-950"
              aria-label="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>
      <main className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}
