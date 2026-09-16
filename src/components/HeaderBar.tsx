import React, { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  Sparkles, 
  Palette,
  BookOpen, 
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
  onOpenJsonModal: () => void;
  onOpenImageManager: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  effectiveUiMode: 'dark' | 'light';
  isDocumentDirty: boolean;
  onOpenWelcome: () => void;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onSaveDocument: () => void;
  onOpenHistory: () => void;
  onOpenAbout: () => void;
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
  onOpenJsonModal,
  onOpenImageManager,
  themeMode,
  onThemeModeChange,
  effectiveUiMode,
  isDocumentDirty,
  onOpenWelcome,
  onNewDocument,
  onOpenDocument,
  onSaveDocument,
  onOpenHistory,
  onOpenAbout,
}) => {
  const [activeDropdown, setActiveDropdown] = useState<'preset' | 'sample' | 'export' | null>(null);

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

  const toggleDropdown = (key: 'preset' | 'sample' | 'export') => {
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
      <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-3 max-w-full">
        
        {/* ================= LEFT SECTION: Brand & View Switcher ================= */}
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          {/* Logo & Product Brand (Click to open About) */}
          <div 
            onClick={onOpenAbout} 
            className="flex items-center gap-2.5 cursor-pointer group select-none"
            title="关于 SangDocCraft (点击查看开源信息)"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenAbout();
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
              <p className={`text-[10px] tracking-wider font-medium ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                智能 Markdown 排版工具
              </p>
            </div>
          </div>

          <div className={`hidden sm:block w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />

          {/* View Mode Segmented Control */}
          <div 
            className={`hidden md:flex items-center p-0.5 rounded-lg border ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100/90 border-slate-200'
            }`}
          >
            <button
              onClick={() => onViewModeChange('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'split'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="左右双栏：编辑与 A4 预览"
            >
              <Layout className="w-3.5 h-3.5" />
              <span>双栏</span>
            </button>
            
            <button
              onClick={() => onViewModeChange('edit')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'edit'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="专注 Markdown 编辑"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>编辑</span>
            </button>

            <button
              onClick={() => onViewModeChange('preview')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'preview'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
              title="A4 交付文档全屏预览"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>全屏</span>
            </button>
          </div>
        </div>

        {/* ================= RIGHT SECTION: Structured Toolbars ================= */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Group 1: Document File Actions */}
          <div 
            className={`flex items-center p-0.5 rounded-lg border shrink-0 ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100/90 border-slate-200'
            }`}
          >
            <button 
              onClick={onOpenWelcome} 
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition ${
                isDark 
                  ? 'text-blue-400 hover:text-white hover:bg-zinc-800' 
                  : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50/80'
              }`} 
              title="开始主页与模板中心"
            >
              <Layout className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">主页</span>
            </button>
            <button 
              onClick={onNewDocument} 
              className={`p-1.5 rounded-md text-xs transition ${
                isDark ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`} 
              title="新建文档 (选择模板或空白)"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={onOpenDocument} 
              className={`p-1.5 rounded-md text-xs transition ${
                isDark ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`} 
              title="打开 .sdc 文档"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={onSaveDocument} 
              className={`relative p-1.5 rounded-md text-xs transition ${
                isDark ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`} 
              title={isDocumentDirty ? "文档有未保存变更 (Ctrl+S 保存)" : "保存文档 (Ctrl+S)"}
            >
              <Save className="w-3.5 h-3.5" />
              {isDocumentDirty && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500 ring-2 ring-transparent animate-pulse" />
              )}
            </button>
            <button 
              onClick={onOpenHistory} 
              className={`p-1.5 rounded-md text-xs transition ${
                isDark ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`} 
              title="历史快照与自动备份"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className={`hidden lg:block w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />

          {/* Group 2: Content & Asset Management */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Sample Templates Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('sample')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                  activeDropdown === 'sample'
                    ? isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'
                    : isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title="载入官方排版范本"
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                <span className="hidden sm:inline">范本</span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              {activeDropdown === 'sample' && (
                <div 
                  className={`absolute right-0 top-full mt-1.5 w-64 border rounded-xl shadow-2xl z-50 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150 ${
                    isDark ? 'bg-[#181818] border-zinc-800 text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                    选择演示范本
                  </div>
                  <button
                    onClick={() => {
                      onMarkdownChange(SAMPLE_MARKDOWNS.systemTemplate);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
                      isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <div className="truncate">
                      <div className="font-semibold">本系统 Markdown 范本</div>
                      <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>完整特性、语法与排版指南</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      onMarkdownChange(SAMPLE_MARKDOWNS.architectureDoc);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
                      isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <div className="truncate">
                      <div className="font-semibold">架构设计说明书</div>
                      <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>技术方案、架构图与参数规范</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      onMarkdownChange(SAMPLE_MARKDOWNS.uiDesignDoc);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
                      isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div className="truncate">
                      <div className="font-semibold">UI/UX 体验设计交付规范</div>
                      <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>视觉组件、交互模式与设计系统</div>
                    </div>
                  </button>

                  <div className={`my-1 border-t ${isDark ? 'border-zinc-800' : 'border-slate-100'}`} />

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
                      <Layout className="w-3.5 h-3.5 shrink-0" />
                      <span>浏览更多模板</span>
                    </div>
                    <span className="text-[10px] opacity-70">前往欢迎页</span>
                  </button>
                </div>
              )}
            </div>

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
              <span className="hidden sm:inline">图片</span>
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
              <span className="hidden sm:inline">主题库</span>
            </button>
          </div>

          <div className={`w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />

          {/* Group 3: Active Document Delivery Theme Selector */}
          <div className="relative shrink-0">
            <button
              onClick={() => toggleDropdown('preset')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition max-w-[170px] ${
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

          {/* Group 5: Theme Switcher (3 options: System / Light / Dark, default System) */}
          <div 
            className={`flex items-center p-0.5 rounded-lg border shrink-0 ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100/90 border-slate-200'
            }`}
            role="radiogroup"
            aria-label="深浅色外观切换"
          >
            <button
              onClick={() => onThemeModeChange('system')}
              className={`p-1.5 rounded-md text-xs font-medium transition ${
                themeMode === 'system'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
              }`}
              title="跟随系统外观 (默认)"
              role="radio"
              aria-checked={themeMode === 'system'}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onThemeModeChange('light')}
              className={`p-1.5 rounded-md text-xs font-medium transition ${
                themeMode === 'light'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
              }`}
              title="浅色模式"
              role="radio"
              aria-checked={themeMode === 'light'}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onThemeModeChange('dark')}
              className={`p-1.5 rounded-md text-xs font-medium transition ${
                themeMode === 'dark'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
              }`}
              title="深色模式"
              role="radio"
              aria-checked={themeMode === 'dark'}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Group 6: About Modal Trigger */}
          <button
            onClick={onOpenAbout}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition shrink-0 ${
              isDark 
                ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white' 
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 shadow-xs'
            }`}
            title="关于 SangDocCraft (开源项目与协议)"
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
