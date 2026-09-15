import React from 'react';
import { History, RotateCcw, Trash2, X } from 'lucide-react';
import type { DocumentHistoryEntry, DocumentSettings } from '../types';

interface DocumentHistoryModalProps {
  isOpen: boolean;
  isDark: boolean;
  settings: DocumentSettings;
  history: DocumentHistoryEntry[];
  onClose: () => void;
  onSettingsChange: (settings: DocumentSettings) => void;
  onRestore: (entry: DocumentHistoryEntry) => void;
  onClear: () => void;
}

export const DocumentHistoryModal: React.FC<DocumentHistoryModalProps> = ({
  isOpen,
  isDark,
  settings,
  history,
  onClose,
  onSettingsChange,
  onRestore,
  onClear,
}) => {
  if (!isOpen) return null;
  const panelClass = isDark ? 'bg-[#181818] border-[#2A2A2A] text-white' : 'bg-white border-slate-200 text-slate-900';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-slate-500';

  return (
    <div className="fixed inset-0 z-[70] bg-black/65 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="编辑历史">
      <div className={`w-full max-w-2xl max-h-[80vh] border rounded-lg shadow-2xl flex flex-col ${panelClass}`}>
        <div className="h-14 px-4 border-b border-inherit flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2"><History className="w-5 h-5 text-blue-500" /><strong>编辑历史</strong></div>
          <button onClick={onClose} className="p-2 rounded hover:bg-slate-500/15" title="关闭"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 border-b border-inherit flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={settings.historyEnabled} onChange={(event) => onSettingsChange({ ...settings, historyEnabled: event.target.checked })} />
            为此文档保存编辑历史
          </label>
          <label className={`flex items-center gap-2 text-xs ${mutedClass}`}>
            无修改
            <input type="number" min="1" max="120" value={settings.historyIdleMinutes} onChange={(event) => onSettingsChange({ ...settings, historyIdleMinutes: Math.min(120, Math.max(1, Number(event.target.value) || 1)) })} className="w-16 rounded border border-inherit bg-transparent px-2 py-1" />
            分钟后记录
          </label>
          {history.length > 0 && <button onClick={onClear} className="ml-auto text-xs text-red-500 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />清空历史</button>}
        </div>
        <div className="overflow-auto p-4 space-y-2">
          {[...history].reverse().map((entry) => (
            <div key={entry.id} className="border border-inherit rounded-md px-3 py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold">{new Date(entry.createdAt).toLocaleString()}</div>
                <div className={`text-[10px] ${mutedClass}`}>{entry.reason === 'manual' ? '手动保存' : '空闲快照'} · {entry.markdown.length} 字符</div>
              </div>
              <button onClick={() => onRestore(entry)} className="px-2.5 py-1.5 rounded border border-inherit text-xs font-bold flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" />恢复</button>
            </div>
          ))}
          {history.length === 0 && <div className={`py-12 text-center text-sm ${mutedClass}`}>尚无历史记录</div>}
        </div>
      </div>
    </div>
  );
};