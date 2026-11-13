import { Clock, FileCode, FileText, Trash2 } from 'lucide-react';
import type { DocumentDraftSummary } from '../utils/draftStore';
import type { RecentDocumentItem } from '../utils/recentDocumentsStore';

export interface RecentDocumentListProps {
  isDark: boolean;
  drafts: DocumentDraftSummary[];
  recentDocuments: RecentDocumentItem[];
  onRestoreDraft: (draft: DocumentDraftSummary) => void;
  onDeleteDraft: (id: string) => void;
  onClearAllDrafts: () => void;
  onOpenRecent: (item: RecentDocumentItem) => void;
  onRemoveRecent: (id: string) => void;
  onClearRecent: () => void;
}

export function RecentDocumentList({
  isDark, drafts, recentDocuments, onRestoreDraft, onDeleteDraft, onClearAllDrafts,
  onOpenRecent, onRemoveRecent, onClearRecent,
}: RecentDocumentListProps) {
  const entries = [
    ...recentDocuments.map(file => ({ kind: 'file' as const, id: file.id, title: file.title, time: file.lastOpenedAt, file })),
    ...drafts.map(draft => ({ kind: 'draft' as const, id: draft.documentId, title: draft.title, time: draft.updatedAt, draft })),
  ].sort((a, b) => b.time.localeCompare(a.time));
  const muted = isDark ? 'text-zinc-400' : 'text-slate-500';
  const actionClass = `text-xs px-3 py-1.5 rounded-xl border transition ${isDark ? 'border-zinc-700 hover:bg-zinc-800' : 'border-slate-200 hover:bg-slate-100'}`;

  return (
    <section className={`rounded-2xl border p-6 flex flex-col gap-4 ${isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />最近文档
          <span className={`text-xs font-normal ${muted}`}>{entries.length} 个文档</span>
        </h2>
        <div className="flex gap-2">
          {recentDocuments.length > 0 && <button type="button" className={actionClass} onClick={onClearRecent}>清空文件记录</button>}
          {drafts.length > 0 && <button type="button" className={actionClass} onClick={onClearAllDrafts}>清空草稿</button>}
        </div>
      </div>
      {entries.length === 0 ? (
        <div className={`py-10 px-4 rounded-xl border border-dashed text-center flex flex-col items-center gap-2.5 ${
          isDark ? 'border-zinc-800 text-zinc-500' : 'border-slate-200 text-slate-400'
        }`}>
          <FileText className="w-8 h-8 opacity-40" aria-hidden="true" />
          <div className="text-xs font-medium">暂无最近文档</div>
          <p className="text-[11px] opacity-70">打开本地 .sdc 文件，或选择上方模板开始。</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-500/10">
          {entries.map(entry => {
            const isFile = entry.kind === 'file';
            const fileName = entry.kind === 'file' ? entry.file.fileName : undefined;
            const repeatedName = fileName?.trim().replace(/\.sdc$/i, '') === entry.title.trim().replace(/\.sdc$/i, '');
            const detail = entry.kind === 'file'
              ? entry.file.path || (repeatedName ? undefined : fileName)
              : `${entry.draft.themeName} · ${entry.draft.charCount} 字 / ${entry.draft.lineCount} 行`;
            return (
              <li key={`${entry.kind}:${entry.id}`} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-slate-50'}`}>
                <button
                  type="button"
                  className="flex-1 min-w-0 flex items-center gap-3 text-left py-2"
                  onClick={() => entry.kind === 'file' ? onOpenRecent(entry.file) : onRestoreDraft(entry.draft)}
                >
                  {isFile ? <FileCode className="w-5 h-5 shrink-0 text-blue-500" /> : <FileText className="w-5 h-5 shrink-0 text-amber-500" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-bold truncate" title={entry.title}>{entry.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${isFile ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-600'}`}>
                        {isFile ? '本地文件' : '浏览器草稿'}
                      </span>
                    </span>
                    {detail && <span className={`block truncate text-[11px] mt-1 ${muted}`} title={detail}>{detail}</span>}
                  </span>
                  <time className={`hidden sm:block text-[11px] shrink-0 ${muted}`} dateTime={entry.time}>
                    {new Date(entry.time).toLocaleString()}
                  </time>
                </button>
                <button
                  type="button"
                  className={`p-2 rounded-lg hover:text-red-500 ${muted}`}
                  title={isFile ? '移除记录（不删除文件）' : '删除草稿及其关联资源'}
                  aria-label={`${isFile ? '移除记录' : '删除草稿'}：${entry.title}`}
                  onClick={() => entry.kind === 'file' ? onRemoveRecent(entry.id) : onDeleteDraft(entry.id)}
                ><Trash2 className="w-4 h-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
