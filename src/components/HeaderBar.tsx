import React, { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  Sparkles, 
  Palette, 
  Layout, 
  Eye, 
  Edit3,
  Images,
  ChevronDown,
  Check,
  Sun,
  Moon,
  Monitor,
  FilePlus2,
  FolderOpen,
  Save,
  History,
  FileText,
  Layers,
  Info,
  Printer,
} from 'lucide-react';
import { DocumentTheme, ThemeMode, ViewMode } from '../types';
import { SAMPLE_MARKDOWNS } from '../data/defaultMarkdown';

interface HeaderBarProps {
  currentTheme: DocumentTheme;
  themes: DocumentTheme[];
  customThemeIds: string[];
  onThemeChange: (theme: DocumentTheme) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onMarkdownChange: (md: string) => void;
  onExportDocx: () => void;
  onExportHtml: () => void;
  onExportSdc: () => void;
  onOpenPrintPdf?: () => void;
  onOpenJsonModal: () => void;
  onOpenImageManager: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  effectiveUiMode: 'dark' | 'light';
  isDocumentDirty: boolean;
  saveStatus?: 'saved' | 'saving' | 'unsaved';
  lastSavedAt?: string | null;
  onOpenWelcome: () => void;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onSaveDocument: () => void;
  onOpenHistory: () => void;
  onOpenAbout: () => void;
  onToggleAiAssistant?: () => void;
  isAiAssistantOpen?: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentTheme,
  themes,
  customThemeIds,
  onThemeChange,
  viewMode,
  onViewModeChange,
  onMarkdownChange,
  onExportDocx,
  onExportHtml,
  onExportSdc,
  onOpenPrintPdf,
  onOpenJsonModal,
  onOpenImageManager,
  themeMode,
  onThemeModeChange,
  effectiveUiMode,
  isDocumentDirty,
  saveStatus,
  lastSavedAt,
  onOpenWelcome,
  onNewDocument,
  onOpenDocument,
  onSaveDocument,
  onOpenHistory,
  onOpenAbout,
  onToggleAiAssistant,
  isAiAssistantOpen,
}) => {
  const [activeDropdown, setActiveDropdown] = useState<'file' | 'preset' | 'export' | 'appearance' | null>(null);

  const isDark = effectiveUiMode === 'dark';
  const headerRef = useRef<HTMLElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (key: 'file' | 'preset' | 'export' | 'appearance') => {
    setActiveDropdown((prev) => (prev === key ? null : key));
  };

  return (
    <header 
      ref={headerRef}
      className={`relative z-40 w-full transition-colors duration-200 border-b select-none ${
        isDark 
          ? 'bg-[#141414] border-[#242424] text-zinc-100' 
          : 'bg-white border-slate-200/90 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
      }`}
    >
      <div className="h-14 px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2 sm:gap-3 max-w-full">
        
        {/* ================= LEFT SECTION: Brand & View Switcher ================= */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
          {/* Logo & Product Brand: Click to return to Welcome Dashboard */}
          <div 
            onClick={onOpenWelcome} 
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group select-none hover:opacity-90 transition-opacity"
            title="返回欢迎页 (点击返回主页与模板中心)"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenWelcome();
              }
            }}
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 group-hover:bg-blue-500 transition-colors flex items-center justify-center font-mono font-black text-white text-xs shadow-sm ring-1 ring-blue-500/30 shrink-0">
              SDC
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-sm group-hover:text-blue-500 transition-colors">
                  SANG<span className="text-blue-500 font-black">DOCCRAFT</span>
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
                  V{__APP_VERSION__}
                </span>
              </div>
              <p className={`hidden xl:block text-[10px] tracking-wider font-medium ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                智能 Markdown 排版工具
              </p>
            </div>
          </div>

          <div className={`hidden sm:block w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />

          {/* View Mode Segmented Control */}
          <div 
            className={`flex items-center p-0.5 rounded-lg border ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100/90 border-slate-200'
            }`}
          >
            <button
              onClick={() => onViewModeChange('split')}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'split'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="左右双栏：编辑与 A4 预览"
            >
              <Layout className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">双栏</span>
            </button>
            
            <button
              onClick={() => onViewModeChange('edit')}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'edit'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="专注 Markdown 编辑"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">编辑</span>
            </button>

            <button
              onClick={() => onViewModeChange('preview')}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'preview'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="A4 交付文档全屏预览"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">全屏</span>
            </button>
          </div>
        </div>

        {/* ================= RIGHT SECTION: Optimized Grouped Toolbar ================= */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Group 1: Unified Document File Dropdown & Direct Save */}
          <div className="relative flex items-center gap-1 shrink-0">
            {/* File Menu Dropdown (Unifies New, Open, History, Sample Templates, Welcome) */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('file')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                  activeDropdown === 'file'
                    ? isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'
                    : isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title="文件管理与排版范本"
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
                <span>文件</span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              {activeDropdown === 'file' && (
                <div 
                  className={`absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-72 border rounded-xl shadow-2xl z-50 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150 ${
                    isDark ? 'bg-[#181818] border-zinc-800 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  {/* 文档管理 */}
                  <div className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                    文档管理
                  </div>

                  <button
                    onClick={() => {
                      onNewDocument();
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${
                      isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <FilePlus2 className="w-4 h-4 text-blue-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">新建文档</div>
                      <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>选择模板或创建空白文档</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenDocument();
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${
                      isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <FolderOpen className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">打开 .sdc 文档</div>
                      <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>载入本地排版工程包</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenHistory();
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${
                      isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <History className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">历史快照与自动备份</div>
                      <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>浏览与回滚近期历史版本</div>
                    </div>
                  </button>

                  <div className={`my-1 border-t ${isDark ? 'border-zinc-800' : 'border-slate-100'}`} />

                  {/* 排版演示范本 */}
                  <div className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                    排版演示范本
                  </div>

                  <button
                    onClick={() => {
                      onMarkdownChange(SAMPLE_MARKDOWNS.systemTemplate);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${
                      isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">本系统 Markdown 范本</div>
                      <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>语法、特性与排版指南</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onMarkdownChange(SAMPLE_MARKDOWNS.architectureDoc);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${
                      isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">架构设计说明书</div>
                      <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>技术方案、架构图与参数规范</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onMarkdownChange(SAMPLE_MARKDOWNS.uiDesignDoc);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition ${
                      isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">UI/UX 体验设计交付规范</div>
                      <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>视觉组件与设计系统规范</div>
                    </div>
                  </button>

                  <div className={`my-1 border-t ${isDark ? 'border-zinc-800' : 'border-slate-100'}`} />

                  {/* 返回欢迎页快捷项 */}
                  <button
                    onClick={() => {
                      onOpenWelcome();
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 transition ${
                      isDark ? 'hover:bg-zinc-800 text-blue-400' : 'hover:bg-blue-50/70 text-blue-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layout className="w-4 h-4 shrink-0" />
                      <span>返回欢迎页与模板中心</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Direct Save Button with Unsaved Dot */}
            <button 
              onClick={onSaveDocument} 
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                isDocumentDirty
                  ? isDark
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
                    : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                  : isDark 
                    ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300' 
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`} 
              title={
                isDocumentDirty 
                  ? "文档有未保存变更 (Ctrl+S 保存)" 
                  : lastSavedAt
                  ? `已保存至本地草稿 (${lastSavedAt})`
                  : "保存文档 (Ctrl+S)"
              }
            >
              <Save className={`w-3.5 h-3.5 ${saveStatus === 'saving' ? 'animate-spin text-blue-500' : ''}`} />
              <span className="hidden sm:inline">
                {saveStatus === 'saving' ? '保存中' : '保存'}
              </span>
              {isDocumentDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          </div>

          <div className={`hidden md:block w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />

          {/* Group 2: AI Assistant & Document Assets */}
          <div className="flex items-center gap-1 shrink-0">
            {/* AI Assistant Global Float Toggle Button */}
            {onToggleAiAssistant && (
              <button
                onClick={onToggleAiAssistant}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                  isAiAssistantOpen
                    ? 'bg-blue-600 border-blue-500 text-white shadow-xs'
                    : isDark
                    ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-blue-400 hover:text-blue-300'
                    : 'bg-white hover:bg-blue-50/70 border-blue-200/80 text-blue-600'
                }`}
                title="打开/关闭 AI 智能写作与排版助手"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AI 助手</span>
              </button>
            )}

            {/* Images Manager Button */}
            <button
              onClick={onOpenImageManager}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                isDark 
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
              title="收集、压缩和管理文档图片素材"
            >
              <Images className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden lg:inline">图片</span>
            </button>

            {/* Theme JSON Config Manager */}
            <button
              onClick={onOpenJsonModal}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                isDark 
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
              title="导入、导出和管理自定义主题样式方案"
            >
              <Palette className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden lg:inline">主题库</span>
            </button>
          </div>

          <div className={`w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />

          {/* Group 3: Active Document Delivery Theme Selector */}
          <div className="relative shrink-0">
            <button
              onClick={() => toggleDropdown('preset')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition max-w-[120px] sm:max-w-[150px] lg:max-w-[180px] ${
                activeDropdown === 'preset'
                  ? isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'
                  : isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
              }`}
              title={`当前交付规范主题：${currentTheme.name}`}
            >
              <div 
                className="w-2.5 h-2.5 rounded-full ring-1 ring-black/20 shrink-0" 
                style={{ backgroundColor: currentTheme.style.primaryColor }} 
              />
              <span className="truncate">{currentTheme.name}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
            </button>

            {activeDropdown === 'preset' && (
              <div 
                className={`absolute right-0 top-full mt-1.5 w-72 border rounded-xl shadow-2xl z-50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150 ${
                  isDark ? 'bg-[#181818] border-zinc-800 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <div className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  选择交付规范主题
                </div>
                <div className="max-h-72 overflow-y-auto space-y-0.5">
                  {themes.map((preset, index) => {
                    const isSelected = preset.id === currentTheme.id;
                    const isCustom = customThemeIds.includes(preset.id);
                    return (
                      <React.Fragment key={preset.id}>
                        {isCustom && (index === 0 || !customThemeIds.includes(themes[index - 1].id)) && (
                          <div className={`px-2.5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider border-t mt-1 ${isDark ? 'text-zinc-500 border-zinc-800' : 'text-slate-400 border-slate-200'}`}>
                            自定义主题方案
                          </div>
                        )}
                        <button
                          onClick={() => {
                            onThemeChange(preset);
                            setActiveDropdown(null);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition ${
                            isSelected
                              ? 'bg-blue-600 text-white font-semibold'
                              : isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div 
                              className="w-3 h-3 rounded-full border border-white/20 shrink-0" 
                              style={{ backgroundColor: preset.style.primaryColor }} 
                            />
                            <span className="truncate">{preset.name}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Group 4: Export CTA */}
          <div className="relative shrink-0">
            <button
              onClick={() => toggleDropdown('export')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition shadow-sm ${
                isDark 
                  ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出</span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            {activeDropdown === 'export' && (
              <div 
                className={`absolute right-0 top-full mt-1.5 w-64 border rounded-xl shadow-2xl z-50 p-1.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150 ${
                  isDark ? 'bg-[#181818] border-zinc-800 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {onOpenPrintPdf && (
                  <button
                    onClick={() => {
                      onOpenPrintPdf();
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2.5 transition ${
                      isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-md bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      <Printer className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold flex items-center justify-between">
                        <span>打印 / 导出 PDF</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">推荐</span>
                      </div>
                      <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>通过 HTML 打印导出 PDF，排版更佳</div>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => {
                    onExportDocx();
                    setActiveDropdown(null);
                  }}
                  className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2.5 transition ${
                    isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    W
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">导出 Word (.docx)</div>
                    <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>含封面、页眉页脚与目录</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onExportHtml();
                    setActiveDropdown(null);
                  }}
                  className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2.5 transition ${
                    isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div className="w-7 h-7 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    H
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">导出 HTML 网页 (.html)</div>
                    <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>自包含单文件，随处预览</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onExportSdc();
                    setActiveDropdown(null);
                  }}
                  className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2.5 transition ${
                    isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div className="w-7 h-7 rounded-md bg-violet-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    S
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">SangDocCraft 文档 (.sdc)</div>
                    <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>打包正文、主题、图片与历史</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <div className={`w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />

          {/* Group 5: Appearance Switcher Dropdown (Single sleek button) */}
          <div className="relative shrink-0">
            <button
              onClick={() => toggleDropdown('appearance')}
              className={`flex items-center gap-1 p-1.5 rounded-lg border text-xs font-medium transition ${
                activeDropdown === 'appearance'
                  ? isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'
                  : isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
              title={`外观模式：${themeMode === 'system' ? '跟随系统' : themeMode === 'light' ? '浅色模式' : '深色模式'}`}
              aria-label="切换界面外观主题"
            >
              {themeMode === 'system' && <Monitor className="w-3.5 h-3.5" />}
              {themeMode === 'light' && <Sun className="w-3.5 h-3.5" />}
              {themeMode === 'dark' && <Moon className="w-3.5 h-3.5" />}
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            {activeDropdown === 'appearance' && (
              <div 
                className={`absolute right-0 top-full mt-1.5 w-36 border rounded-xl shadow-2xl z-50 p-1.5 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150 ${
                  isDark ? 'bg-[#181818] border-zinc-800 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  外观模式
                </div>
                <button
                  onClick={() => {
                    onThemeModeChange('system');
                    setActiveDropdown(null);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${
                    themeMode === 'system'
                      ? 'bg-blue-600 text-white font-semibold'
                      : isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5" />
                    <span>跟随系统</span>
                  </div>
                  {themeMode === 'system' && <Check className="w-3 h-3" />}
                </button>

                <button
                  onClick={() => {
                    onThemeModeChange('light');
                    setActiveDropdown(null);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${
                    themeMode === 'light'
                      ? 'bg-blue-600 text-white font-semibold'
                      : isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5" />
                    <span>浅色模式</span>
                  </div>
                  {themeMode === 'light' && <Check className="w-3 h-3" />}
                </button>

                <button
                  onClick={() => {
                    onThemeModeChange('dark');
                    setActiveDropdown(null);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${
                    themeMode === 'dark'
                      ? 'bg-blue-600 text-white font-semibold'
                      : isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Moon className="w-3.5 h-3.5" />
                    <span>深色模式</span>
                  </div>
                  {themeMode === 'dark' && <Check className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>

          {/* Group 6: About Modal Trigger */}
          <button
            onClick={onOpenAbout}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition shrink-0 ${
              isDark 
                ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white' 
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 shadow-2xs'
            }`}
            title="关于 SangDocCraft (开源项目与版本协议)"
            aria-label="关于 SangDocCraft"
          >
            <Info className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">关于</span>
          </button>

        </div>

      </div>
    </header>
  );
};
