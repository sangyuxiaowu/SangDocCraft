import React, { useState } from 'react';
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
  FilePlus2,
  FolderOpen,
  Save,
  History,
} from 'lucide-react';
import { DocumentTheme, ViewMode } from '../types';
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
  uiMode: 'dark' | 'light';
  onToggleUiMode: () => void;
  documentTitle: string;
  isDocumentDirty: boolean;
  onNewDocument: () => void;
  onOpenDocument: () => void;
  onSaveDocument: () => void;
  onOpenHistory: () => void;
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
  uiMode,
  onToggleUiMode,
  documentTitle,
  isDocumentDirty,
  onNewDocument,
  onOpenDocument,
  onSaveDocument,
  onOpenHistory,
}) => {
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [showSampleDropdown, setShowSampleDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  const isDark = uiMode === 'dark';

  return (
    <header className={`${isDark ? 'bg-[#181818] border-[#2A2A2A] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xs'} border-b px-6 md:px-8 py-3 sticky top-0 z-40 w-full transition-colors duration-200`}>
      <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* LEFT PART: Brand Title & View Mode Switcher */}
        <div className="flex items-center gap-4 flex-wrap justify-start">
          {/* Brand & Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-mono font-black text-white text-xs shadow-md shrink-0">
              SDC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tighter">
                  SANG<span className="text-blue-500">DOCCRAFT</span>
                </h1>
                <span className="text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-blue-500/20 text-blue-500 border border-blue-500/30 shrink-0">
                  V{__APP_VERSION__}
                </span>
              </div>
              <p className={`text-[10px] uppercase tracking-[0.2em] font-bold ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                智能 Markdown 排版工具
              </p>
            </div>
          </div>

          <div className={`hidden sm:block w-px h-6 ${isDark ? 'bg-[#2A2A2A]' : 'bg-slate-200'}`} />

          {/* View Mode Switcher */}
          <div className={`flex items-center p-1 rounded-lg border ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-slate-100 border-slate-200'}`}>
            <button
              onClick={() => onViewModeChange('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'split'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark ? 'text-zinc-400 hover:text-white hover:bg-[#2A2A2A]/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
              }`}
              title="左右双栏：编辑与 A4 预览"
            >
              <Layout className="w-3.5 h-3.5" />
              <span>双栏预览</span>
            </button>
            
            <button
              onClick={() => onViewModeChange('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'edit'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark ? 'text-zinc-400 hover:text-white hover:bg-[#2A2A2A]/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
              }`}
              title="纯编辑模式"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>专注编辑</span>
            </button>

            <button
              onClick={() => onViewModeChange('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'preview'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark ? 'text-zinc-400 hover:text-white hover:bg-[#2A2A2A]/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
              }`}
              title="A4 规范全屏预览"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>A4 全屏</span>
            </button>
          </div>
        </div>

        {/* RIGHT PART: Action Controls & Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-0.5 mr-1">
            <button onClick={onNewDocument} className={`p-2 rounded ${isDark ? 'hover:bg-[#2A2A2A]' : 'hover:bg-slate-100'}`} title="新建文档"><FilePlus2 className="w-4 h-4" /></button>
            <button onClick={onOpenDocument} className={`p-2 rounded ${isDark ? 'hover:bg-[#2A2A2A]' : 'hover:bg-slate-100'}`} title="打开 .sdc 文档"><FolderOpen className="w-4 h-4" /></button>
            <button onClick={onSaveDocument} className={`p-2 rounded ${isDark ? 'hover:bg-[#2A2A2A]' : 'hover:bg-slate-100'}`} title="保存文档 (Ctrl+S)"><Save className="w-4 h-4" /></button>
            <button onClick={onOpenHistory} className={`p-2 rounded ${isDark ? 'hover:bg-[#2A2A2A]' : 'hover:bg-slate-100'}`} title="文档设置与编辑历史"><History className="w-4 h-4" /></button>
          </div>
          <div className={`max-w-32 truncate text-[10px] font-bold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`} title={documentTitle}>
            {documentTitle}{isDocumentDirty ? ' *' : ''}
          </div>
          
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={onToggleUiMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider transition-all ${
              isDark 
                ? 'bg-[#0A0A0A] hover:bg-[#2A2A2A] border-[#2A2A2A] text-amber-400' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-amber-600 shadow-xs'
            }`}
            title={isDark ? '切换至浅色模式' : '切换至深色模式'}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-zinc-200">浅色界面</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-slate-700">深色界面</span>
              </>
            )}
          </button>

          {/* Preset Theme Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowPresetDropdown(!showPresetDropdown);
                setShowSampleDropdown(false);
                setShowExportDropdown(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider transition ${
                isDark 
                  ? 'bg-[#0A0A0A] hover:bg-[#2A2A2A] border-[#2A2A2A] text-zinc-200' 
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800 font-bold'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>{currentTheme.name}</span>
              <ChevronDown className={`w-3 h-3 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`} />
            </button>

            {showPresetDropdown && (
              <div className={`absolute right-0 mt-2 w-72 border rounded-lg shadow-2xl z-50 p-1.5 ${
                isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-200 shadow-xl'
              }`}>
                <div className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                  isDark ? 'text-zinc-400' : 'text-slate-500'
                }`}>
                  选择预设交付规范主题
                </div>
                <div className="space-y-1">
                  {themes.map((preset, index) => {
                    const isSelected = preset.id === currentTheme.id;
                    const isCustom = customThemeIds.includes(preset.id);
                    return (
                      <React.Fragment key={preset.id}>
                        {isCustom && (index === 0 || !customThemeIds.includes(themes[index - 1].id)) && (
                          <div className={`px-2 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest border-t ${isDark ? 'text-zinc-500 border-[#2A2A2A]' : 'text-slate-400 border-slate-200'}`}>自定义主题</div>
                        )}
                        <button
                          onClick={() => {
                            onThemeChange(preset);
                            setShowPresetDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition ${
                            isSelected
                              ? 'bg-blue-600 text-white font-bold'
                              : isDark ? 'text-zinc-200 hover:bg-[#2A2A2A]' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-3 h-3 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: preset.style.primaryColor }} />
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

          {/* Sample Templates Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSampleDropdown(!showSampleDropdown);
                setShowPresetDropdown(false);
                setShowExportDropdown(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider transition ${
                isDark 
                  ? 'bg-[#0A0A0A] hover:bg-[#2A2A2A] border-[#2A2A2A] text-zinc-200' 
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800 font-bold'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              <span>载入范本</span>
              <ChevronDown className={`w-3 h-3 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`} />
            </button>

            {showSampleDropdown && (
              <div className={`absolute right-0 mt-2 w-60 border rounded-lg shadow-2xl z-50 p-1.5 ${
                isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-200 shadow-xl'
              }`}>
                <button
                  onClick={() => {
                    onMarkdownChange(SAMPLE_MARKDOWNS.systemTemplate);
                    setShowSampleDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition ${
                    isDark ? 'text-zinc-200 hover:bg-[#2A2A2A]' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  本系统 Markdown 范本
                </button>
                <button
                  onClick={() => {
                    onMarkdownChange(SAMPLE_MARKDOWNS.architectureDoc);
                    setShowSampleDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition ${
                    isDark ? 'text-zinc-200 hover:bg-[#2A2A2A]' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  分布式系统架构设计说明书
                </button>
                <button
                  onClick={() => {
                    onMarkdownChange(SAMPLE_MARKDOWNS.uiDesignDoc);
                    setShowSampleDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition ${
                    isDark ? 'text-zinc-200 hover:bg-[#2A2A2A]' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  UI/UX 体验设计交付规范
                </button>
                <button
                  onClick={() => {
                    onMarkdownChange('# 新增交付文档\n\n请在此处输入您的 Markdown 内容...');
                    setShowSampleDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition border-t mt-1 pt-2 ${
                    isDark ? 'text-zinc-500 hover:text-zinc-200 hover:bg-[#2A2A2A] border-[#2A2A2A]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  清空并创建空白文档
                </button>
              </div>
            )}
          </div>

          {/* Theme Manager */}
          <button
            onClick={onOpenImageManager}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider transition ${
              isDark
                ? 'bg-[#0A0A0A] hover:bg-[#2A2A2A] border-[#2A2A2A] text-zinc-200'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
            }`}
            title="收集、压缩和管理文档图片"
          >
            <Images className="w-3.5 h-3.5 text-blue-500" />
            <span>图片</span>
          </button>

          {/* Theme Manager */}
          <button
            onClick={onOpenJsonModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider transition ${
              isDark 
                ? 'bg-[#0A0A0A] hover:bg-[#2A2A2A] border-[#2A2A2A] text-zinc-200' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800 font-bold'
            }`}
            title="创建、导入和管理自定义主题"
          >
            <Palette className="w-3.5 h-3.5 text-blue-500" />
            <span>主题管理</span>
          </button>

          {/* Export Button & Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowExportDropdown(!showExportDropdown);
                setShowPresetDropdown(false);
                setShowSampleDropdown(false);
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded font-black text-xs uppercase tracking-tighter transition shadow-md ${
                isDark 
                  ? 'bg-white hover:bg-zinc-200 text-black' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出文档</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showExportDropdown && (
              <div className={`absolute right-0 mt-2 w-64 border rounded-lg shadow-2xl z-50 p-2 space-y-1 ${
                isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-200 shadow-xl'
              }`}>
                <button
                  onClick={() => {
                    onExportDocx();
                    setShowExportDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded text-xs flex items-center gap-2.5 transition ${
                    isDark ? 'text-white hover:bg-[#2A2A2A]' : 'text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    W
                  </div>
                  <div>
                    <div className="font-bold uppercase tracking-wider">导出 Word (.docx)</div>
                    <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>带完整页眉页脚与封面样式</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onExportHtml();
                    setShowExportDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded text-xs flex items-center gap-2.5 transition ${
                    isDark ? 'text-white hover:bg-[#2A2A2A]' : 'text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-7 h-7 rounded bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    H
                  </div>
                  <div>
                    <div className="font-bold uppercase tracking-wider">导出 HTML 网页 (.html)</div>
                    <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>单文件自包含格式，随时网页查阅</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onExportSdc();
                    setShowExportDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded text-xs flex items-center gap-2.5 transition ${
                    isDark ? 'text-white hover:bg-[#2A2A2A]' : 'text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <div className="w-7 h-7 rounded bg-violet-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    S
                  </div>
                  <div>
                    <div className="font-bold uppercase tracking-wider">下载 SangDocCraft 文档 (.sdc)</div>
                    <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>包含正文、主题、图片与历史</div>
                  </div>
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
