import React, { useEffect, useRef } from 'react';
import { 
  Check, 
  X, 
  RotateCcw, 
  CheckCheck, 
  Sparkles, 
  GitPullRequest,
  AlertCircle,
  FileText
} from 'lucide-react';
import { DiffHunk } from '../../types/ai';
import { getDiffSummary } from '../../utils/diffUtils';

interface AiDiffReviewPanelProps {
  sessionId: string;
  hunks: DiffHunk[];
  onAcceptHunk: (hunkId: string) => void;
  onRejectHunk: (hunkId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onApplyResolution: () => void;
  onCancelReview: () => void;
  isDark: boolean;
  description?: string;
}

export const AiDiffReviewPanel: React.FC<AiDiffReviewPanelProps> = ({
  sessionId,
  hunks,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
  onApplyResolution,
  onCancelReview,
  isDark,
  description
}) => {
  const summary = getDiffSummary(hunks);
  const hunkElementsRef = useRef(new Map<string, HTMLDivElement>());
  const latestHunksRef = useRef(hunks);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  latestHunksRef.current = hunks;
  let changeCounter = 0;

  const scrollToHunk = (hunkId: string) => {
    hunkElementsRef.current.get(hunkId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  useEffect(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    const firstPendingHunk = latestHunksRef.current.find(hunk => hunk.type === 'change' && hunk.status === 'pending');
    if (firstPendingHunk) scrollToHunk(firstPendingHunk.id);

    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [sessionId]);

  const scheduleNextPendingHunk = (resolvedHunkId: string) => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      const currentHunks = latestHunksRef.current;
      const resolvedIndex = currentHunks.findIndex(hunk => hunk.id === resolvedHunkId);
      const nextPendingHunk = [
        ...currentHunks.slice(resolvedIndex + 1),
        ...currentHunks.slice(0, Math.max(0, resolvedIndex))
      ].find(hunk => hunk.type === 'change' && hunk.status === 'pending' && hunk.id !== resolvedHunkId);
      if (nextPendingHunk) scrollToHunk(nextPendingHunk.id);
      scrollTimerRef.current = null;
    }, 500);
  };

  const handleAcceptHunk = (hunkId: string) => {
    onAcceptHunk(hunkId);
    scheduleNextPendingHunk(hunkId);
  };

  const handleRejectHunk = (hunkId: string) => {
    onRejectHunk(hunkId);
    scheduleNextPendingHunk(hunkId);
  };

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-[#0E0E0E] text-zinc-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Top Review Bar (VS Code / Git style) */}
      <div className={`shrink-0 px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
        isDark ? 'bg-[#141414] border-[#262626]' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
            <GitPullRequest className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm truncate">AI 修改审查</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                审查
              </span>
            </div>
            <div className={`text-xs mt-0.5 flex items-center gap-2 flex-wrap ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              <span>共 <strong className="font-semibold">{summary.totalChanges}</strong> 处变更</span>
              <span>·</span>
              <span className="text-emerald-500 font-medium">+{summary.addedCount} 行</span>
              <span>/</span>
              <span className="text-rose-500 font-medium">-{summary.removedCount} 行</span>
              {summary.pendingCount > 0 ? (
                <>
                  <span>·</span>
                  <span className="text-amber-500 font-medium">剩余 {summary.pendingCount} 处待确认</span>
                </>
              ) : (
                <>
                  <span>·</span>
                  <span className="text-emerald-500 font-semibold">所有变更已确认</span>
                </>
              )}
            </div>
            {description && (
              <div className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                {description}
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onAcceptAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors"
            title="接受所有段落的修改建议"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>全部接受</span>
          </button>

          <button
            type="button"
            onClick={onRejectAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              isDark 
                ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200' 
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
            }`}
            title="放弃所有修改，恢复原始内容"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>全部撤销</span>
          </button>

          <div className={`w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />

          <button
            type="button"
            onClick={onApplyResolution}
            disabled={summary.pendingCount > 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition-colors"
            title="应用当前已确认的变更并返回编辑器"
          >
            <Check className="w-3.5 h-3.5" />
            <span>完成审查</span>
          </button>

          <button
            type="button"
            onClick={onCancelReview}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              isDark 
                ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' 
                : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800'
            }`}
            title="取消审查（保留原文档）"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Review Diff Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 font-mono text-xs leading-relaxed select-text">
        <div className={`rounded-xl border overflow-hidden ${
          isDark ? 'bg-[#080808] border-[#222]' : 'bg-white border-slate-200'
        }`}>
          {hunks.map((hunk) => {
            if (hunk.type === 'unchanged') {
              return (
                <div key={hunk.id} className="py-1">
                  {hunk.lines.map((line, idx) => (
                    <div
                      key={`${hunk.id}-${idx}`}
                      className={`flex items-start px-3 py-0.5 hover:bg-white/5 transition-colors ${
                        isDark ? 'text-zinc-400' : 'text-slate-600'
                      }`}
                    >
                      <span className={`w-10 shrink-0 select-none text-right pr-3 text-[10px] ${
                        isDark ? 'text-zinc-600' : 'text-slate-400'
                      }`}>
                        {line.oldLineNumber || ''}
                      </span>
                      <span className={`w-10 shrink-0 select-none text-right pr-3 text-[10px] ${
                        isDark ? 'text-zinc-600' : 'text-slate-400'
                      }`}>
                        {line.newLineNumber || ''}
                      </span>
                      <span className="w-5 shrink-0 select-none text-center opacity-30"> </span>
                      <pre className="flex-1 font-mono whitespace-pre-wrap break-words">{line.content || ' '}</pre>
                    </div>
                  ))}
                </div>
              );
            }

            // Change Hunk
            changeCounter++;
            const currentChangeNum = changeCounter;

            return (
              <div 
                key={hunk.id} 
                data-hunk-id={hunk.id}
                ref={element => {
                  if (element) hunkElementsRef.current.set(hunk.id, element);
                  else hunkElementsRef.current.delete(hunk.id);
                }}
                className={`my-3 mx-2 rounded-lg border overflow-hidden transition-all ${
                  hunk.status === 'accepted'
                    ? isDark ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-emerald-300 bg-emerald-50/40'
                    : hunk.status === 'rejected'
                    ? isDark ? 'border-zinc-800 bg-zinc-900/30 opacity-70' : 'border-slate-300 bg-slate-50/60 opacity-70'
                    : isDark ? 'border-amber-500/40 bg-[#121212] shadow-sm' : 'border-amber-300 bg-amber-50/20 shadow-sm'
                }`}
              >
                {/* Hunk Header Action Bar */}
                <div className={`px-3 py-2 border-b flex items-center justify-between gap-2 text-xs select-none ${
                  hunk.status === 'accepted'
                    ? isDark ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-emerald-100/70 border-emerald-200 text-emerald-800'
                    : hunk.status === 'rejected'
                    ? isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                    : isDark ? 'bg-zinc-900/90 border-[#262626] text-zinc-200' : 'bg-slate-100/90 border-slate-200 text-slate-800'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[11px]">变更 #{currentChangeNum}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      hunk.status === 'accepted'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-semibold'
                        : hunk.status === 'rejected'
                        ? 'bg-zinc-500/20 text-zinc-600 dark:text-zinc-400'
                        : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold'
                    }`}>
                      {hunk.status === 'accepted' ? '✓ 已接受' : hunk.status === 'rejected' ? '✕ 已保留原文' : '待确认'}
                    </span>
                    <span className="text-[10px] opacity-70">
                      (原第 {hunk.oldStartLine} 行)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAcceptHunk(hunk.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                        hunk.status === 'accepted'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : isDark
                          ? 'hover:bg-emerald-900/40 text-emerald-400 border border-emerald-500/30'
                          : 'hover:bg-emerald-100 text-emerald-700 border border-emerald-300 bg-white'
                      }`}
                      title="接受此处的 AI 修改"
                    >
                      <Check className="w-3 h-3" />
                      <span>接受</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRejectHunk(hunk.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                        hunk.status === 'rejected'
                          ? isDark ? 'bg-zinc-700 text-white' : 'bg-slate-300 text-slate-900'
                          : isDark
                          ? 'hover:bg-zinc-800 text-zinc-400 border border-zinc-700'
                          : 'hover:bg-slate-200 text-slate-600 border border-slate-300 bg-white'
                      }`}
                      title="放弃此段修改，保留原内容"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>保留原文</span>
                    </button>
                  </div>
                </div>

                {/* Hunk Lines Rendering */}
                <div className="py-1">
                  {hunk.lines.map((line, idx) => {
                    const isRemoved = line.type === 'removed';
                    const isAdded = line.type === 'added';

                    // When rejected, highlight original lines normally and hide/strike added lines
                    // When accepted, show added lines cleanly
                    let lineBg = '';
                    let textClass = '';
                    let markerClass = '';

                    if (isRemoved) {
                      lineBg = isDark ? 'bg-rose-950/30 hover:bg-rose-950/40' : 'bg-rose-50 hover:bg-rose-100/70';
                      textClass = isDark ? 'text-rose-300' : 'text-rose-800';
                      markerClass = 'text-rose-500 font-bold';
                      if (hunk.status === 'accepted') {
                        lineBg += ' opacity-40 line-through';
                      }
                    } else if (isAdded) {
                      lineBg = isDark ? 'bg-emerald-950/30 hover:bg-emerald-950/40' : 'bg-emerald-50 hover:bg-emerald-100/70';
                      textClass = isDark ? 'text-emerald-300' : 'text-emerald-800';
                      markerClass = 'text-emerald-500 font-bold';
                      if (hunk.status === 'rejected') {
                        lineBg += ' opacity-40 line-through';
                      }
                    }

                    return (
                      <div
                        key={`${hunk.id}-${idx}`}
                        className={`flex items-start px-3 py-0.5 transition-colors ${lineBg}`}
                      >
                        <span className={`w-10 shrink-0 select-none text-right pr-3 text-[10px] ${
                          isDark ? 'text-zinc-600' : 'text-slate-400'
                        }`}>
                          {line.oldLineNumber || ''}
                        </span>
                        <span className={`w-10 shrink-0 select-none text-right pr-3 text-[10px] ${
                          isDark ? 'text-zinc-600' : 'text-slate-400'
                        }`}>
                          {line.newLineNumber || ''}
                        </span>
                        <span className={`w-5 shrink-0 select-none text-center ${markerClass}`}>
                          {isRemoved ? '-' : isAdded ? '+' : ' '}
                        </span>
                        <pre className={`flex-1 font-mono whitespace-pre-wrap break-words ${textClass}`}>
                          {line.content || ' '}
                        </pre>
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
