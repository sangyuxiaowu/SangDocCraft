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

export type ThemeTabKey = 'cover' | 'header' | 'footer' | 'toc' | 'style' | 'mermaid' | 'all';

interface ThemeTabOption {
  key: ThemeTabKey;
  label: string;
  tag: string;
  desc: string;
}

const THEME_TABS: ThemeTabOption[] = [
  { key: 'cover', label: '封面', tag: 'cover', desc: '封面样式、元数据字段与展示开关' },
  { key: 'header', label: '页眉', tag: 'header', desc: '页眉左中右文字、装饰线与规则' },
  { key: 'footer', label: '页脚', tag: 'footer', desc: '页脚说明、页码格式与对齐规则' },
  { key: 'toc', label: '目录', tag: 'toc', desc: '目录标题、层级深度与引导符样式' },
  { key: 'style', label: '排版样式', tag: 'style', desc: '配色方案、字体、正文间距与水印配置' },
  { key: 'mermaid', label: 'Mermaid', tag: 'mermaid', desc: '图表主题与自定义配色' },
  { key: 'all', label: '全部配置', tag: 'all', desc: '完整样式代码 (不含 ID / 名称 / 描述)' },
];

function splitTheme(theme: DocumentTheme) {
  const { id, name, description, ...body } = theme;
  return {
    id: id || '',
    name: name || '',
    description: description || '',
    body: body as Record<string, unknown>,
  };
}

function getTabCode(tab: ThemeTabKey, body: Record<string, unknown>): string {
  if (tab === 'all') {
    return JSON.stringify(body, null, 2);
  }
  const part = body[tab] ?? {};
  return JSON.stringify(part, null, 2);
}

function syncTabToBody(
  tab: ThemeTabKey,
  code: string,
  body: Record<string, unknown>
): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(code);
    if (tab === 'all') {
      const { id: _i, name: _n, description: _d, ...clean } = parsed;
      return clean;
    }
    return {
      ...body,
      [tab]: parsed,
    };
  } catch {
    return null;
  }
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
  const [themeId, setThemeId] = useState('');
  const [themeName, setThemeName] = useState('');
  const [themeDescription, setThemeDescription] = useState('');
  const [configBody, setConfigBody] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState<ThemeTabKey>('cover');
  const [codeString, setCodeString] = useState('');
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
    const { id, name, description, body } = splitTheme(currentTheme);
    setSelectedId(id);
    setThemeId(id);
    setThemeName(name);
    setThemeDescription(description);
    setConfigBody(body);
    setCodeString(getTabCode(activeTab, body));
    setIsDraft(false);
    setMessage(null);
    setDeleteTarget(null);
  }, [isOpen, currentTheme]);

  if (!isOpen) return null;

  const handleSwitchTab = (newTab: ThemeTabKey) => {
    if (newTab === activeTab) return;
    const updated = syncTabToBody(activeTab, codeString, configBody);
    if (!updated) {
      setMessage({ type: 'error', text: `当前“${THEME_TABS.find((t) => t.key === activeTab)?.label}” JSON 格式有误，请修正语法后再切换` });
      return;
    }
    setConfigBody(updated);
    setActiveTab(newTab);
    setCodeString(getTabCode(newTab, updated));
    setMessage(null);
  };

  const selectTheme = (theme: DocumentTheme) => {
    const { id, name, description, body } = splitTheme(theme);
    setSelectedId(id);
    setThemeId(id);
    setThemeName(name);
    setThemeDescription(description);
    setConfigBody(body);
    setCodeString(getTabCode(activeTab, body));
    setIsDraft(false);
    setMessage(null);
  };

  const createTheme = () => {
    const fullCurrent = getFullTheme() || currentTheme;
    const custom = createCustomTheme(fullCurrent, allThemes.map((theme) => theme.id));
    const { id, name, description, body } = splitTheme(custom);
    setSelectedId(id);
    setThemeId(id);
    setThemeName(name);
    setThemeDescription(description);
    setConfigBody(body);
    setCodeString(getTabCode(activeTab, body));
    setIsDraft(true);
    setMessage(null);
  };

  const getFullTheme = (): DocumentTheme | null => {
    try {
      const trimmedId = themeId.trim() || selectedId;
      const trimmedName = themeName.trim() || '未命名主题';
      const updatedBody = syncTabToBody(activeTab, codeString, configBody) || configBody;
      const { id: _ignoreId, name: _ignoreName, description: _ignoreDesc, ...cleanBody } = updatedBody;
      return {
        id: trimmedId,
        name: trimmedName,
        description: themeDescription.trim(),
        ...cleanBody,
      } as DocumentTheme;
    } catch {
      return null;
    }
  };

  const saveAndApply = () => {
    try {
      const trimmedId = themeId.trim();
      const trimmedName = themeName.trim();
      if (!trimmedId) throw new Error('主题 ID 不能为空');
      if (!trimmedName) throw new Error('主题名称不能为空');

      const updatedBody = syncTabToBody(activeTab, codeString, configBody);
      if (!updatedBody) {
        throw new Error(`当前“${THEME_TABS.find((t) => t.key === activeTab)?.label}” JSON 语法有误，请检查修正`);
      }

      const { id: _ignoreId, name: _ignoreName, description: _ignoreDesc, ...cleanBody } = updatedBody;

      const fullTheme = {
        id: trimmedId,
        name: trimmedName,
        description: themeDescription.trim(),
        ...cleanBody,
      };

      const parsed = validateTheme(fullTheme);
      const builtinConflict = builtinThemes.some((theme) => theme.id === parsed.id);
      const customConflict = customThemes.some((theme) => theme.id === parsed.id && theme.id !== (isDraft ? '' : selectedId));
      if (builtinConflict || customConflict) {
        throw new Error(`主题 ID “${parsed.id}” 已存在，请使用唯一 ID`);
      }

      onSaveTheme(parsed, isCustom ? selectedId : undefined);
      onApplyTheme(parsed);
      setSelectedId(parsed.id);
      setThemeId(parsed.id);
      setThemeName(parsed.name);
      setThemeDescription(parsed.description);

      const { id: _i, name: _n, description: _d, ...savedClean } = parsed;
      setConfigBody(savedClean as Record<string, unknown>);
      setCodeString(getTabCode(activeTab, savedClean as Record<string, unknown>));
      setIsDraft(false);
      setMessage({ type: 'success', text: '自定义主题已保存并应用' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '保存失败' });
    }
  };

  const downloadTheme = () => {
    const fullTheme = getFullTheme();
    const jsonToExport = fullTheme ? JSON.stringify(fullTheme, null, 2) : codeString;
    const blob = new Blob([jsonToExport], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `theme_${themeId.trim() || selectedId || 'custom'}.json`;
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
        const { id, name, description, body } = splitTheme(parsed);
        setSelectedId(id);
        setThemeId(id);
        setThemeName(name);
        setThemeDescription(description);
        setConfigBody(body);
        setCodeString(getTabCode(activeTab, body));
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
    const { id, name, description, body } = splitTheme(fallback);
    setSelectedId(id);
    setThemeId(id);
    setThemeName(name);
    setThemeDescription(description);
    setConfigBody(body);
    setCodeString(getTabCode(activeTab, body));
    setDeleteTarget(null);
    setMessage({ type: 'success', text: '自定义主题已删除' });
  };

  const panelClass = isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-200';
  const mutedClass = isDark ? 'text-zinc-500' : 'text-slate-500';
  const secondaryClass = isDark ? 'bg-[#242424] hover:bg-[#303030] text-zinc-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700';

  const currentTabInfo = THEME_TABS.find((tab) => tab.key === activeTab) || THEME_TABS[0];

  const renderThemeList = (title: string, themes: DocumentTheme[], custom: boolean) => (
    <section>
      <div className={`px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest ${mutedClass}`}>{title}</div>
      <div className="space-y-1">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => selectTheme(theme)}
            className={`w-full px-3 py-2 text-left rounded flex items-center gap-2 ${
              selectedId === theme.id && !isDraft ? 'bg-blue-600 text-white' : secondaryClass
            }`}
          >
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
      <div className={`border rounded-lg w-full max-w-5xl h-[min(780px,92vh)] overflow-hidden flex flex-col shadow-2xl ${panelClass}`}>
        <header className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? 'border-[#2A2A2A]' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-blue-600 text-white flex items-center justify-center">
              <FileJson className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black">主题管理</h2>
              <p className={`text-[11px] ${mutedClass}`}>创建、导入和维护可复用的交付规范主题</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="关闭主题管理" className={`p-2 rounded ${secondaryClass}`}>
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          <aside className={`w-full md:w-72 max-h-56 md:max-h-none shrink-0 border-b md:border-b-0 md:border-r p-3 overflow-y-auto space-y-4 ${isDark ? 'border-[#2A2A2A] bg-[#121212]' : 'border-slate-200 bg-slate-50'}`}>
            <button
              onClick={createTheme}
              className="w-full flex items-center justify-center gap-2 rounded bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              基于当前主题新建
            </button>
            {renderThemeList('内置主题', builtinThemes, false)}
            {renderThemeList('自定义主题', customThemes, true)}
            {customThemes.length === 0 && (
              <p className={`px-3 text-[11px] leading-5 ${mutedClass}`}>尚无自定义主题。可基于当前主题新建，或导入 JSON 文件。</p>
            )}
          </aside>

          <main className="flex-1 min-w-0 min-h-0 p-3 md:p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">
                  {isDraft ? '新自定义主题 (草稿)' : themeName || selectedTheme?.name}
                </div>
                <div className={`text-[10px] font-mono truncate ${mutedClass}`}>
                  {themeId || selectedId}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(codeString);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  title={`复制当前 ${currentTabInfo.label} JSON`}
                  className={`p-2 rounded ${secondaryClass}`}
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <button onClick={downloadTheme} title="导出完整主题 JSON" className={`p-2 rounded ${secondaryClass}`}>
                  <Download className="w-4 h-4" />
                </button>
                <label title="导入主题 JSON" className={`p-2 rounded cursor-pointer ${secondaryClass}`}>
                  <Upload className="w-4 h-4" />
                  <input type="file" accept=".json,application/json" onChange={importTheme} className="hidden" />
                </label>
                {isCustom && (
                  <button
                    onClick={() => setDeleteTarget(selectedTheme || null)}
                    title="删除自定义主题"
                    className="p-2 rounded bg-red-500/15 text-red-500 hover:bg-red-500/25"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 主题 ID、名称、描述 输入框 */}
            <div className={`p-3 rounded-lg border flex flex-col gap-2.5 ${isDark ? 'bg-[#141414] border-[#2A2A2A]' : 'bg-slate-50 border-slate-200'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* 主题 ID */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="theme-id-input" className={`text-[10px] font-bold uppercase tracking-wider ${mutedClass}`}>
                      主题 ID (唯一标识)
                    </label>
                  </div>
                  <input
                    id="theme-id-input"
                    type="text"
                    value={themeId}
                    readOnly={!canEdit}
                    onChange={(e) => {
                      setThemeId(e.target.value);
                      setMessage(null);
                    }}
                    placeholder="例如: custom-enterprise-blue"
                    className={`w-full px-2.5 py-1.5 rounded border text-xs font-mono outline-none transition ${
                      !canEdit
                        ? isDark
                          ? 'bg-[#0D0D0D] border-[#262626] text-zinc-500 cursor-not-allowed'
                          : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                        : isDark
                          ? 'bg-[#181818] border-[#333] text-zinc-100 focus:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                </div>

                {/* 主题名称 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="theme-name-input" className={`text-[10px] font-bold uppercase tracking-wider ${mutedClass}`}>
                      主题名称
                    </label>
                  </div>
                  <input
                    id="theme-name-input"
                    type="text"
                    value={themeName}
                    readOnly={!canEdit}
                    onChange={(e) => {
                      setThemeName(e.target.value);
                      setMessage(null);
                    }}
                    placeholder="例如: 企业级现代商务蓝"
                    className={`w-full px-2.5 py-1.5 rounded border text-xs outline-none transition ${
                      !canEdit
                        ? isDark
                          ? 'bg-[#0D0D0D] border-[#262626] text-zinc-500 cursor-not-allowed'
                          : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                        : isDark
                          ? 'bg-[#181818] border-[#333] text-zinc-100 font-semibold focus:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-900 font-semibold focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* 主题描述 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="theme-description-input" className={`text-[10px] font-bold uppercase tracking-wider ${mutedClass}`}>
                    主题描述
                  </label>
                </div>
                <input
                  id="theme-description-input"
                  type="text"
                  value={themeDescription}
                  readOnly={!canEdit}
                  onChange={(e) => {
                    setThemeDescription(e.target.value);
                    setMessage(null);
                  }}
                  placeholder="简要描述该主题的适用场景、视觉特点或交付标准..."
                  className={`w-full px-2.5 py-1.5 rounded border text-xs outline-none transition ${
                    !canEdit
                      ? isDark
                        ? 'bg-[#0D0D0D] border-[#262626] text-zinc-500 cursor-not-allowed'
                        : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                      : isDark
                        ? 'bg-[#181818] border-[#333] text-zinc-200 focus:border-blue-500'
                        : 'bg-white border-slate-300 text-slate-700 focus:border-blue-500'
                  }`}
                />
              </div>
            </div>

            {/* 上方模块切换 Tab 栏 (小 JSON 切换) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <div
                  id="theme-modular-tabs"
                  role="tablist"
                  className={`p-1 rounded-lg border flex items-center gap-1 overflow-x-auto ${
                    isDark ? 'bg-[#121212] border-[#2A2A2A]' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  {THEME_TABS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        role="tab"
                        id={`tab-${tab.key}`}
                        aria-selected={isActive}
                        type="button"
                        onClick={() => handleSwitchTab(tab.key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm'
                            : isDark
                              ? 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f1f]'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                            isActive
                              ? 'bg-blue-700/60 text-blue-100'
                              : isDark
                                ? 'bg-zinc-800 text-zinc-400'
                                : 'bg-slate-200/80 text-slate-600'
                          }`}
                        >
                          {tab.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {message && (
              <div
                className={`px-3 py-2 rounded border text-xs flex items-center gap-2 ${
                  message.type === 'error'
                    ? 'border-red-500/30 bg-red-500/10 text-red-500'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                }`}
              >
                {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                {message.text}
              </div>
            )}
            {!canEdit && (
              <div className={`px-3 py-1.5 rounded text-xs ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                内置主题为只读锁定。点击“基于当前主题新建”后可自由修改并保存自定义版本。
              </div>
            )}

            <div className="flex items-center justify-between mt-0.5">
              <label htmlFor="theme-code-textarea" className={`text-[10px] font-bold uppercase tracking-wider ${mutedClass}`}>
                {currentTabInfo.label} JSON ({currentTabInfo.tag})
              </label>
            </div>

            <textarea
              id="theme-code-textarea"
              aria-label={`${currentTabInfo.label} JSON`}
              value={codeString}
              readOnly={!canEdit}
              onChange={(event) => {
                setCodeString(event.target.value);
                setMessage(null);
              }}
              className={`flex-1 min-h-0 w-full resize-none rounded border p-3 font-mono text-xs leading-5 outline-none ${
                isDark
                  ? 'bg-[#0A0A0A] border-[#333] text-blue-300 focus:border-blue-500'
                  : 'bg-slate-50 border-slate-300 text-blue-800 focus:border-blue-500'
              } ${!canEdit ? 'opacity-75 cursor-not-allowed' : ''}`}
              spellCheck={false}
            />

            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className={`px-4 py-2 rounded text-xs font-bold ${secondaryClass}`}>
                关闭
              </button>
              {canEdit && (
                <button
                  onClick={saveAndApply}
                  className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  保存并应用
                </button>
              )}
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
