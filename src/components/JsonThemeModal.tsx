import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, Download, FileJson, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import type { DocumentTheme } from '../types';
import { createCustomTheme, validateTheme } from '../themes/customThemeStore';

interface JsonThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: DocumentTheme;
  builtinThemes: DocumentTheme[];
  customThemes: DocumentTheme[];
  onApplyTheme: (theme: DocumentTheme) => void;
  onSaveTheme: (theme: DocumentTheme, previousId?: string) => void;
  onDeleteTheme: (id: string) => void;
  isDark?: boolean;
}

export const JsonThemeModal: React.FC<JsonThemeModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  builtinThemes,
  customThemes,
  onApplyTheme,
  onSaveTheme,
  onDeleteTheme,
  isDark = true,
}) => {
  const [selectedId, setSelectedId] = useState('');
  const [jsonString, setJsonString] = useState('');
  const [isDraft, setIsDraft] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentTheme | null>(null);

  const allThemes = [...builtinThemes, ...customThemes];
  const selectedTheme = allThemes.find((theme) => theme.id === selectedId);
  const isCustom = customThemes.some((theme) => theme.id === selectedId);
  const canEdit = isDraft || isCustom;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(currentTheme.id);
    setJsonString(JSON.stringify(currentTheme, null, 2));
    setIsDraft(false);
    setMessage(null);
    setDeleteTarget(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const selectTheme = (theme: DocumentTheme) => {
    setSelectedId(theme.id);
    setJsonString(JSON.stringify(theme, null, 2));
    setIsDraft(false);
    setMessage(null);
  };

  const createTheme = () => {
    const custom = createCustomTheme(currentTheme, allThemes.map((theme) => theme.id));
    setSelectedId(custom.id);
    setJsonString(JSON.stringify(custom, null, 2));
    setIsDraft(true);
    setMessage(null);
  };

  const saveAndApply = () => {
    try {
      const parsed = validateTheme(JSON.parse(jsonString));
      const builtinConflict = builtinThemes.some((theme) => theme.id === parsed.id);
      const customConflict = customThemes.some((theme) => theme.id === parsed.id && theme.id !== selectedId);
      if (builtinConflict || customConflict) throw new Error(`主题 ID “${parsed.id}” 已存在，请使用唯一 ID`);

      onSaveTheme(parsed, isCustom ? selectedId : undefined);
      onApplyTheme(parsed);
      setSelectedId(parsed.id);
      setJsonString(JSON.stringify(parsed, null, 2));
      setIsDraft(false);
      setMessage({ type: 'success', text: '自定义主题已保存并应用' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'JSON 解析失败' });
    }
  };

  const downloadTheme = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `theme_${selectedId || 'custom'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importTheme = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = validateTheme(JSON.parse(String(reader.result)));
        setSelectedId(parsed.id);
        setJsonString(JSON.stringify(parsed, null, 2));
        setIsDraft(true);
        setMessage({ type: 'success', text: '主题已导入，保存后加入主题列表' });
      } catch (error) {
        setMessage({ type: 'error', text: error instanceof Error ? error.message : '导入失败' });
      }
    };
    reader.readAsText(file);
  };

  const confirmDeleteTheme = () => {
    if (!deleteTarget) return;
    onDeleteTheme(deleteTarget.id);
    const fallback = builtinThemes[0];
    setSelectedId(fallback.id);
    setJsonString(JSON.stringify(fallback, null, 2));
    setDeleteTarget(null);
    setMessage({ type: 'success', text: '自定义主题已删除' });
  };

  const panelClass = isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-200';
  const mutedClass = isDark ? 'text-zinc-500' : 'text-slate-500';
  const secondaryClass = isDark ? 'bg-[#242424] hover:bg-[#303030] text-zinc-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700';

  const renderThemeList = (title: string, themes: DocumentTheme[], custom: boolean) => (
    <section>
      <div className={`px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest ${mutedClass}`}>{title}</div>
      <div className="space-y-1">
        {themes.map((theme) => (
          <button key={theme.id} onClick={() => selectTheme(theme)} className={`w-full px-3 py-2 text-left rounded flex items-center gap-2 ${selectedId === theme.id && !isDraft ? 'bg-blue-600 text-white' : secondaryClass}`}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: theme.style.primaryColor }} />
            <span className="truncate flex-1 text-xs font-semibold">{theme.name}</span>
            {custom && <span className="text-[9px] uppercase opacity-60">自定义</span>}
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`border rounded-lg w-full max-w-5xl h-[min(760px,90vh)] overflow-hidden flex flex-col shadow-2xl ${panelClass}`}>
        <header className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? 'border-[#2A2A2A]' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-blue-600 text-white flex items-center justify-center"><FileJson className="w-4 h-4" /></div>
            <div><h2 className="text-sm font-black">主题管理</h2><p className={`text-[11px] ${mutedClass}`}>创建、导入和维护可复用的交付规范主题</p></div>
          </div>
          <button onClick={onClose} aria-label="关闭主题管理" className={`p-2 rounded ${secondaryClass}`}><X className="w-4 h-4" /></button>
        </header>

        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          <aside className={`w-full md:w-72 max-h-56 md:max-h-none shrink-0 border-b md:border-b-0 md:border-r p-3 overflow-y-auto space-y-4 ${isDark ? 'border-[#2A2A2A] bg-[#121212]' : 'border-slate-200 bg-slate-50'}`}>
            <button onClick={createTheme} className="w-full flex items-center justify-center gap-2 rounded bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-bold"><Plus className="w-4 h-4" />基于当前主题新建</button>
            {renderThemeList('内置主题', builtinThemes, false)}
            {renderThemeList('自定义主题', customThemes, true)}
            {customThemes.length === 0 && <p className={`px-3 text-[11px] leading-5 ${mutedClass}`}>尚无自定义主题。可基于当前主题新建，或导入 JSON 文件。</p>}
          </aside>

          <main className="flex-1 min-w-0 min-h-0 p-3 md:p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0"><div className="text-sm font-bold truncate">{isDraft ? '新自定义主题' : selectedTheme?.name}</div><div className={`text-[10px] font-mono truncate ${mutedClass}`}>{selectedId}</div></div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => { navigator.clipboard.writeText(jsonString); setCopied(true); setTimeout(() => setCopied(false), 1500); }} title="复制 JSON" className={`p-2 rounded ${secondaryClass}`}>{copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}</button>
                <button onClick={downloadTheme} title="导出 JSON" className={`p-2 rounded ${secondaryClass}`}><Download className="w-4 h-4" /></button>
                <label title="导入 JSON" className={`p-2 rounded cursor-pointer ${secondaryClass}`}><Upload className="w-4 h-4" /><input type="file" accept=".json,application/json" onChange={importTheme} className="hidden" /></label>
                {isCustom && <button onClick={() => setDeleteTarget(selectedTheme || null)} title="删除自定义主题" className="p-2 rounded bg-red-500/15 text-red-500 hover:bg-red-500/25"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>

            {message && <div className={`px-3 py-2 rounded border text-xs flex items-center gap-2 ${message.type === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-500' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'}`}>{message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}{message.text}</div>}
            {!canEdit && <div className={`px-3 py-2 rounded text-xs ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>内置主题为只读。点击“基于当前主题新建”后可修改并保存。</div>}
            <textarea aria-label="主题 JSON" value={jsonString} readOnly={!canEdit} onChange={(event) => { setJsonString(event.target.value); setMessage(null); }} className={`flex-1 min-h-0 w-full resize-none rounded border p-4 font-mono text-xs leading-5 outline-none ${isDark ? 'bg-[#0A0A0A] border-[#333] text-blue-300 focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-blue-800 focus:border-blue-500'} ${!canEdit ? 'opacity-75' : ''}`} spellCheck={false} />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={`text-[10px] ${mutedClass}`}>自定义主题保存在当前设备，并显示在顶部主题列表。</span>
              <div className="flex gap-2 shrink-0">
                <button onClick={onClose} className={`px-4 py-2 rounded text-xs font-bold ${secondaryClass}`}>关闭</button>
                {canEdit && <button onClick={saveAndApply} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2"><Save className="w-4 h-4" />保存并应用</button>}
              </div>
            </div>
          </main>
        </div>

        {deleteTarget && (
          <div className="absolute inset-0 z-10 bg-black/65 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-theme-title">
            <div className={`w-full max-w-sm rounded-lg border p-5 shadow-2xl ${panelClass}`}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded bg-red-500/15 text-red-500 flex items-center justify-center shrink-0"><Trash2 className="w-4 h-4" /></div>
                <div>
                  <h3 id="delete-theme-title" className="text-sm font-bold">删除自定义主题</h3>
                  <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>确定删除“{deleteTarget.name}”？此操作无法撤销。</p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setDeleteTarget(null)} className={`px-4 py-2 rounded text-xs font-bold ${secondaryClass}`}>取消</button>
                <button onClick={confirmDeleteTheme} className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold">确认删除</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
