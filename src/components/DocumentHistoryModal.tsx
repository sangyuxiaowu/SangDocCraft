import React, { useState, useMemo } from 'react';
import { 
  History, 
  RotateCcw, 
  Trash2, 
  X, 
  Clock, 
  FileText, 
  Check, 
  Copy, 
  Sparkles, 
  Palette, 
  Save, 
  ArrowRight 
} from 'lucide-react';
import type { DocumentHistoryEntry, DocumentSettings } from '../types';
import { modal } from '../utils/modalDialog';

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
  const [selectedEntryId, setSelectedEntryId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const reversedHistory = useMemo(() => {
    return [...history].reverse();
  }, [history]);

  const selectedEntry = useMemo(() => {
    if (!reversedHistory.length) return null;
    return reversedHistory.find((e) => e.id === selectedEntryId) || reversedHistory[0];
  }, [reversedHistory, selectedEntryId]);

  if (!isOpen) return null;

  const handleRestoreClick = async (entry: DocumentHistoryEntry) => {
    const timeStr = new Date(entry.createdAt).toLocaleString();
    const ok = await modal.confirm({
      title: '恢复历史快照',
      message: `确定要恢复至 ${timeStr} 的版本吗？\n当前未保存的修改将被此历史快照覆盖。`,
      confirmText: '确认恢复',
      cancelText: '取消',
      variant: 'warning',
    });
    if (ok) {
      onRestore(entry);
      onClose();
    }
  };

  const handleClearClick = async () => {
    const ok = await modal.confirm({
      title: '清空历史快照',
      message: '确定清空所有文档历史快照记录吗？此操作将彻底删除历史记录且无法撤销。',
      confirmText: '清空记录',
      cancelText: '取消',
      variant: 'danger',
    });
    if (ok) {
      onClear();
      setSelectedEntryId('');
    }
  };

  const handleCopyContent = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200" 
      role="dialog" 
      aria-modal="true" 
      aria-label="编辑历史"
    >
      <div 
        className={`w-full max-w-4xl h-[min(760px,85vh)] border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-colors ${
          isDark 
            ? 'bg-[#161616] border-zinc-800 text-zinc-100' 
            : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className={`h-15 px-6 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'border-zinc-800 bg-[#191919]' : 'border-slate-100 bg-slate-50/70'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 border border-blue-500/20 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">文档版本与编辑历史</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-200/80 text-slate-700'
                }`}>
                  共 {history.length} 个快照
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                支持自动空闲记录与手动保存快照，随时预览或回滚至先前版本
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className={`p-2 rounded-lg transition ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-slate-200/80 text-slate-500 hover:text-slate-800'
            }`} 
            title="关闭窗口 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Bar */}
        <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-4 shrink-0 ${
          isDark ? 'border-zinc-800/80 bg-[#161616]' : 'border-slate-100 bg-white'
        }`}>
          <div className="flex items-center gap-5 flex-wrap">
            {/* Enable switch */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={settings.historyEnabled} 
                onChange={(e) => onSettingsChange({ ...settings, historyEnabled: e.target.checked })} 
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
              <span className="text-xs font-semibold">为此文档记录版本历史</span>
            </label>

            {/* Idle interval */}
            {settings.historyEnabled && (
              <div className="flex items-center gap-2 text-xs">
                <Clock className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
                <span className={isDark ? 'text-zinc-400' : 'text-slate-500'}>空闲无编辑</span>
                <input 
                  type="number" 
                  min="1" 
                  max="120" 
                  value={settings.historyIdleMinutes} 
                  onChange={(e) => onSettingsChange({ ...settings, historyIdleMinutes: Math.min(120, Math.max(1, Number(e.target.value) || 1)) })} 
                  className={`w-14 rounded-md border px-2 py-0.5 text-xs text-center outline-hidden ${
                    isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`} 
                />
                <span className={isDark ? 'text-zinc-400' : 'text-slate-500'}>分钟后自动生成快照</span>
              </div>
            )}
          </div>

          {history.length > 0 && (
            <button 
              onClick={handleClearClick} 
              className={`text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition ${
                isDark 
                  ? 'border-red-500/20 text-red-400 hover:bg-red-500/10' 
                  : 'border-red-200 text-red-600 hover:bg-red-50'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空全部历史</span>
            </button>
          )}
        </div>

        {/* Content: Left Timeline List + Right Preview */}
        {reversedHistory.length > 0 ? (
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)] overflow-hidden">
            
            {/* Timeline Snapshot List */}
            <div className={`overflow-y-auto p-4 border-r space-y-2 ${
              isDark ? 'border-zinc-800 bg-[#161616]' : 'border-slate-100 bg-slate-50/40'
            }`}>
              {reversedHistory.map((entry, index) => {
                const isSelected = selectedEntry?.id === entry.id;
                const isManual = entry.reason === 'manual';
                const dateObj = new Date(entry.createdAt);

                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedEntryId(entry.id)}
                    className={`relative p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10 shadow-xs'
                        : isDark 
                        ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900' 
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight ${
                          isManual
                            ? 'bg-blue-600/15 text-blue-500 border border-blue-500/20'
                            : 'bg-purple-600/15 text-purple-500 border border-purple-500/20'
                        }`}>
                          {isManual ? '手动保存' : '空闲快照'}
                        </span>
                        {index === 0 && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-200 text-slate-700'
                          }`}>
                            最新
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                        {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-xs font-semibold mb-1">
                      {dateObj.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </div>

                    <div className={`flex items-center gap-3 text-[11px] ${
                      isDark ? 'text-zinc-400' : 'text-slate-500'
                    }`}>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-zinc-500" />
                        {entry.markdown.length} 字符
                      </span>
                      {entry.theme?.name && (
                        <span className="flex items-center gap-1 truncate max-w-[120px]">
                          <Palette className="w-3 h-3 text-zinc-500" />
                          {entry.theme.name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Snapshot Detail & Preview Panel */}
            {selectedEntry ? (
              <div className={`flex flex-col min-h-0 overflow-hidden ${
                isDark ? 'bg-[#181818]' : 'bg-white'
              }`}>
                {/* Preview Toolbar */}
                <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
                  isDark ? 'border-zinc-800 bg-[#1a1a1a]' : 'border-slate-100 bg-slate-50/80'
                }`}>
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-xs font-bold flex items-center gap-2">
                        <span>快照内容预览</span>
                        <span className={`text-[10px] font-normal px-2 py-0.5 rounded-full ${
                          isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {new Date(selectedEntry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                        字数: {selectedEntry.markdown.length} 字符 · 主题: {selectedEntry.theme?.name || '默认主题'}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleCopyContent(selectedEntry.markdown)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
                        copied
                          ? 'border-emerald-500 text-emerald-500'
                          : isDark ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-white text-slate-700'
                      }`}
                      title="仅复制该快照的 Markdown 文本至剪贴板"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? '已复制' : '复制正文'}</span>
                    </button>

                    <button
                      onClick={() => handleRestoreClick(selectedEntry)}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>恢复至此版本</span>
                    </button>
                  </div>
                </div>

                {/* Preview text view */}
                <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed select-text whitespace-pre-wrap">
                  <div className={`p-4 rounded-xl border ${
                    isDark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    {selectedEntry.markdown || '(正文内容为空)'}
                  </div>
                </div>
              </div>
            ) : null}

          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 ${
              isDark ? 'bg-zinc-800/80 text-zinc-500' : 'bg-slate-100 text-slate-400'
            }`}>
              <History className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold mb-1">尚无文档历史记录</h3>
            <p className={`text-xs max-w-sm mb-4 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              开启上方“记录版本历史”选项后，系统将在您编辑闲置时自动备份快照，您也可以随时使用快捷键 Ctrl+S / ⌘+S 手动保存快照。
            </p>
          </div>
        )}

      </div>
    </div>
  );
};
