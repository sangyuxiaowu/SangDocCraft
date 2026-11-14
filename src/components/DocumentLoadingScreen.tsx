import { Loader2 } from 'lucide-react';

export function DocumentLoadingScreen({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 ${
        isDark ? 'bg-[#121212] text-zinc-100' : 'bg-slate-100 text-slate-900'
      }`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="h-9 w-9 animate-spin text-blue-500 will-change-transform motion-reduce:animate-none" aria-hidden="true">
        <Loader2 className="h-9 w-9" />
      </span>
      <div className="text-center">
        <h1 className="text-lg font-semibold">正在打开文档</h1>
        <p className={`mt-2 text-sm ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
          正在读取文档和准备工作区，请稍候…
        </p>
      </div>
    </div>
  );
}
