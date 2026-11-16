import { BookOpenCheck, Headphones, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "../ui/BrandMark";
import { ThemeToggle } from "../ui/ThemeToggle";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="pointer-events-none absolute inset-0 auth-grid opacity-60 dark:opacity-25" />
      <div className="pointer-events-none absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-indigo-300/30 blur-3xl dark:bg-indigo-700/15" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[460px] w-[460px] rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-700/15" />

      <div className="absolute right-5 top-5 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl items-stretch lg:grid-cols-[1.05fr_0.95fr] lg:p-6">
        <section className="relative hidden overflow-hidden rounded-[34px] bg-gradient-to-br from-indigo-700 via-violet-700 to-cyan-700 p-10 text-white shadow-2xl shadow-indigo-950/20 lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/10 bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full border border-cyan-200/10 bg-cyan-300/10 blur-2xl" />

          <div className="relative">
            <BrandMark />
          </div>

          <div className="relative my-12 max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold backdrop-blur">
              <Sparkles className="h-4 w-4 text-cyan-200" />
              Không để từ mới bị lãng quên
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.12] tracking-tight xl:text-5xl">
              Một nơi gọn gàng để lưu và nghe lại từ vựng TOEIC.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-indigo-100">
              Ghi lại từ vừa học, tải phát âm của bạn và mở nghe lại bất cứ lúc nào.
            </p>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {[
                [BookOpenCheck, "Lưu nhanh", "Anh – Việt rõ ràng"],
                [Headphones, "Nghe lại", "Audio ngay bên cạnh"],
                [ShieldCheck, "Riêng tư", "Dữ liệu theo tài khoản"],
              ].map(([Icon, title, copy]) => {
                const FeatureIcon = Icon as typeof BookOpenCheck;
                return (
                  <div
                    key={title as string}
                    className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"
                  >
                    <FeatureIcon className="h-5 w-5 text-cyan-200" />
                    <p className="mt-3 text-sm font-bold">{title as string}</p>
                    <p className="mt-1 text-xs leading-5 text-indigo-100">
                      {copy as string}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="relative text-xs text-indigo-200">
            TOEIC Vocabulary · Học theo nhịp của riêng bạn
          </p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-20 sm:px-8 lg:min-h-0 lg:px-12 xl:px-20">
          <div className="w-full max-w-md">
            <div className="mb-9 lg:hidden">
              <BrandMark />
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
