import React, { useState, useEffect } from 'react';
import { 
  FilePlus2, 
  FolderOpen, 
  Sparkles, 
  Cpu, 
  Palette, 
  Briefcase, 
  GraduationCap, 
  ClipboardList, 
  FileText, 
  Clock, 
  Trash2, 
  ArrowRight, 
  Check, 
  X, 
  Sun, 
  Moon, 
  Info,
  Laptop,
  FileCode,
  HardDrive,
  ExternalLink,
  ChevronRight,
  Heart,
  Download,
  ZoomIn
} from 'lucide-react';
import { DOCUMENT_TEMPLATES, type DocumentTemplateCategory, type DocumentTemplateItem } from '../data/documentTemplates';
import type { DocumentDraftSummary } from '../utils/draftStore';
import type { RecentDocumentItem } from '../utils/recentDocumentsStore';
import type { ThemeMode } from '../types';

const WELCOME_REWARD_STORAGE_KEY = 'sangdoccraft_welcome_reward_dismissed';

interface WelcomeDashboardProps {
  isOpen: boolean;
  onClose?: () => void;
  canClose: boolean; // 是否可以关闭（例如已有文档正在编辑中）
  isDark: boolean;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  isTauri: boolean;
  // Templates & Actions
  onSelectTemplate: (template: DocumentTemplateItem) => void;
  onOpenLocalFile: () => void;
  onOpenAbout: () => void;
  // Web Mode: Unsaved Drafts
  drafts: DocumentDraftSummary[];
  onRestoreDraft: (draft: DocumentDraftSummary) => void;
  onDeleteDraft: (documentId: string) => void;
  onClearAllDrafts: () => void;
  // Tauri Mode: Recent Documents
  recentDocuments: RecentDocumentItem[];
  onOpenRecentPath: (path: string) => void;
  onRemoveRecent: (path: string) => void;
  onClearRecent: () => void;
}

export const WelcomeDashboard: React.FC<WelcomeDashboardProps> = ({
  isOpen,
  onClose,
  canClose,
  isDark,
  themeMode,
  onThemeModeChange,
  isTauri,
  onSelectTemplate,
  onOpenLocalFile,
  onOpenAbout,
  drafts,
  onRestoreDraft,
  onDeleteDraft,
  onClearAllDrafts,
  recentDocuments,
  onOpenRecentPath,
  onRemoveRecent,
  onClearRecent,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | DocumentTemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRewardTip, setShowRewardTip] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WELCOME_REWARD_STORAGE_KEY) !== 'true';
    } catch {
      return true;
    }
  });
  const [showLargeQrModal, setShowLargeQrModal] = useState(false);

  const handleDismissRewardTip = () => {
    setShowRewardTip(false);
    try {
      localStorage.setItem(WELCOME_REWARD_STORAGE_KEY, 'true');
    } catch {}
  };

  // Handle ESC key to close if canClose is true
  useEffect(() => {
    if (!isOpen || !canClose || !onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canClose, onClose]);

  if (!isOpen) return null;

  const filteredTemplates = DOCUMENT_TEMPLATES.filter((tpl) => {
    const matchesCategory = selectedCategory === 'all' || tpl.category === selectedCategory;
    const matchesQuery = !searchQuery.trim() || 
      tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      tpl.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) || 
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'sparkles': return <Sparkles className="w-5 h-5 text-blue-500" />;
      case 'cpu': return <Cpu className="w-5 h-5 text-indigo-500" />;
      case 'palette': return <Palette className="w-5 h-5 text-cyan-500" />;
      case 'briefcase': return <Briefcase className="w-5 h-5 text-amber-500" />;
      case 'graduation-cap': return <GraduationCap className="w-5 h-5 text-emerald-500" />;
      case 'clipboard-list': return <ClipboardList className="w-5 h-5 text-teal-500" />;
      default: return <FileText className="w-5 h-5 text-blue-500" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) return '刚刚';
      if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
      if (diffHours < 24) return `${diffHours} 小时前`;
      if (diffDays === 1) return '昨天 ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (diffDays < 7) return `${diffDays} 天前`;
      return date.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto flex flex-col select-none transition-colors duration-200 ${
      isDark ? 'bg-[#121212] text-zinc-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* ================= Top Header (Consistent with Editor HeaderBar) ================= */}
      <header className={`sticky top-0 z-20 border-b backdrop-blur-md transition-colors duration-200 select-none ${
        isDark 
          ? 'bg-[#141414]/95 border-[#242424] text-zinc-100' 
          : 'bg-white/95 border-slate-200/90 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
      }`}>
        <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-3 max-w-full">
          {/* ================= LEFT SECTION: Brand (Identical with Editor HeaderBar) ================= */}
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
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
                  <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full border shrink-0 ${
                    isTauri 
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' 
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                  }`}>
                    {isTauri ? '桌面版' : 'Web 版'}
                  </span>
                </div>
                <p className={`text-[10px] tracking-wider font-medium ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  智能 Markdown 排版工具
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 shrink-0">
          {/* Open Local .sdc Document */}
          <button
            type="button"
            onClick={onOpenLocalFile}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
              isDark 
                ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200' 
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-xs'
            }`}
            title="打开本地 .sdc 文件"
          >
            <FolderOpen className="w-4 h-4 text-blue-500" />
            <span>打开 .sdc 文档</span>
          </button>

          {/* Theme Mode Toggle */}
          <button
            type="button"
            onClick={() => onThemeModeChange(isDark ? 'light' : 'dark')}
            className={`p-2 rounded-xl border transition ${
              isDark 
                ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300' 
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
            }`}
            title={`切换至${isDark ? '浅色' : '深色'}模式`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* About Button */}
          <button
            type="button"
            onClick={onOpenAbout}
            className={`p-2 rounded-xl border transition ${
              isDark 
                ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300' 
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
            }`}
            title="关于 SangDocCraft"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Return to Current Document (if editing) */}
          {canClose && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition ml-1.5"
              title="返回当前编辑文档 (Esc)"
            >
              <span>返回编辑</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        </div>
      </header>

      {/* ================= Main Word-Style Dashboard Body ================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-8">
        
        {/* ================= First-Time Non-Intrusive Friendly WeChat Reward Banner ================= */}
        {showRewardTip && (
          <div className={`relative rounded-2xl border p-4 sm:p-5 transition-all duration-300 overflow-hidden shadow-xs ${
            isDark 
              ? 'bg-gradient-to-r from-amber-500/10 via-zinc-900/90 to-zinc-900/60 border-amber-500/25 text-zinc-200' 
              : 'bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-white border-amber-200/90 text-slate-800'
          }`}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* QR thumbnail + Info */}
              <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                <div 
                  onClick={() => setShowLargeQrModal(true)}
                  className="group relative w-16 h-16 sm:w-20 sm:h-20 p-1.5 bg-white rounded-xl border border-amber-300/80 shadow-xs shrink-0 cursor-pointer flex items-center justify-center transition-transform hover:scale-105"
                  title="点击查看大图扫码赞赏"
                >
                  <img 
                    src="./reward-code.svg" 
                    alt="微信赞赏码" 
                    className="w-full h-full object-contain select-none"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-medium gap-0.5">
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>放大</span>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
                      <span>微信赞赏支持开源</span>
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isDark ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20' : 'bg-amber-100/80 text-amber-800 border border-amber-200'
                    }`}>
                      Buy Me a Coffee
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed max-w-2xl ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                    欢迎使用 SangDocCraft！本应用完全免费、无广告，专注高效严谨的 A4 文档排版。如果它对您的工作有所帮助，欢迎微信扫码赞赏支持作者（桑榆肖物）持续开发维护。
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setShowLargeQrModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Heart className="w-3 h-3 fill-white" />
                  <span>扫码赞赏</span>
                </button>

                <button
                  type="button"
                  onClick={handleDismissRewardTip}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                    isDark 
                      ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' 
                      : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                  }`}
                  title="关闭并不再在欢迎页提示"
                >
                  <span>知道了</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= Section 1: New Document & Templates Guide (Single Row) ================= */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                <span>新建与模板</span>
              </h2>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-600'
              }`}>
                选择模板快速起步
              </span>
            </div>

            {/* Category Filter Tabs */}
            <div className={`flex items-center p-0.5 rounded-xl border shrink-0 ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-200/80 border-slate-200'
            }`}>
              {(['all', 'blank', 'template'] as const).map((cat) => {
                const labels: Record<'all' | DocumentTemplateCategory, string> = {
                  all: '全部',
                  blank: '空白文档',
                  template: '文档模板',
                };
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      active 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {labels[cat]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Templates Single Row */}
          <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-0.5 scrollbar-thin">
            {filteredTemplates.map((template) => {
              const isBlank = template.category === 'blank';
              return (
                <div
                  key={template.id}
                  onClick={() => onSelectTemplate(template)}
                  title={`${template.title} - ${template.description}`}
                  className={`group relative w-36 sm:w-40 shrink-0 rounded-xl border p-2.5 flex flex-col justify-between transition-all duration-200 cursor-pointer overflow-hidden select-none ${
                    isBlank 
                      ? isDark 
                        ? 'bg-gradient-to-b from-zinc-900 to-zinc-900/80 border-zinc-700 hover:border-blue-500 hover:shadow-md hover:shadow-blue-500/10' 
                        : 'bg-white border-blue-200 hover:border-blue-500 hover:shadow-md hover:shadow-blue-500/10 ring-1 ring-blue-500/20'
                      : isDark
                        ? 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 hover:shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/90 hover:shadow-sm'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectTemplate(template);
                    }
                  }}
                >
                  {/* Top Miniature Page Preview */}
                  <div className={`w-full h-20 rounded-lg border p-2 flex flex-col justify-between transition group-hover:scale-[1.02] ${
                    isBlank
                      ? isDark ? 'bg-zinc-800/90 border-zinc-700' : 'bg-slate-50 border-slate-200 shadow-2xs'
                      : isDark ? 'bg-zinc-800/60 border-zinc-700/60' : 'bg-slate-100/70 border-slate-200/80'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="p-1 rounded bg-white/10 dark:bg-black/20">
                        {isBlank ? <FilePlus2 className="w-4 h-4 text-blue-500" /> : getTemplateIcon(template.iconName)}
                      </div>
                      {template.badge && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          isBlank
                            ? 'bg-blue-500 text-white'
                            : isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {template.badge}
                        </span>
                      )}
                    </div>

                    {/* Miniature simulated lines */}
                    <div className="space-y-1">
                      <div className={`h-1.5 rounded w-3/4 ${isDark ? 'bg-zinc-600/60' : 'bg-slate-300/80'}`} />
                      <div className={`h-1 rounded w-1/2 ${isDark ? 'bg-zinc-700/60' : 'bg-slate-200'}`} />
                    </div>
                  </div>

                  {/* Bottom Compact Metadata */}
                  <div className="mt-2 min-w-0">
                    <h3 className="text-xs font-bold tracking-tight truncate group-hover:text-blue-500 transition-colors" title={template.title}>
                      {template.title}
                    </h3>
                    <p className={`text-[10px] truncate mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} title={template.subtitle}>
                      {template.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================= Section 2: Recent Documents or Unsaved Projects ================= */}
        <section className={`rounded-2xl border p-6 flex flex-col gap-4 ${
          isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <h2 className="text-base font-bold tracking-tight">
                  {isTauri ? '最近打开的文档' : '本地草稿文档'}
                </h2>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-600'
                }`}>
                  {isTauri ? `${recentDocuments.length} 个历史记录` : `${drafts.length} 个本地草稿`}
                </span>
              </div>
              {isTauri && (
                <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  本地 .sdc 历史文件，点击即可在桌面上快速读取与继续编辑。
                </p>
              )}
            </div>

            {/* Clear All Button */}
            {((isTauri && recentDocuments.length > 0) || (!isTauri && drafts.length > 0)) && (
              <button
                type="button"
                onClick={isTauri ? onClearRecent : onClearAllDrafts}
                className={`text-xs px-3 py-1.5 rounded-xl border transition flex items-center gap-1 self-start sm:self-auto ${
                  isDark 
                    ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-red-400' 
                    : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-red-600'
                }`}
                title={isTauri ? '清空所有最近打开历史' : '清空所有未保存草稿'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isTauri ? '清空历史' : '清空草稿'}</span>
              </button>
            )}
          </div>

          {/* List or Empty State */}
          {isTauri ? (
            /* Tauri Mode: Recent Document Files */
            recentDocuments.length === 0 ? (
              <div className={`py-12 px-4 rounded-xl border border-dashed text-center flex flex-col items-center justify-center gap-2.5 ${
                isDark ? 'border-zinc-800 text-zinc-500' : 'border-slate-200 text-slate-400'
              }`}>
                <HardDrive className="w-8 h-8 opacity-40" />
                <div className="text-xs font-medium">暂无最近打开的本地 .sdc 文档</div>
                <button
                  type="button"
                  onClick={onOpenLocalFile}
                  className="mt-1 px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-500 hover:bg-blue-600/20 text-xs font-semibold transition"
                >
                  浏览并打开本地文档
                </button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/40 dark:divide-zinc-800/60">
                {recentDocuments.map((item) => (
                  <div
                    key={item.id || item.path}
                    className={`group py-3 px-3.5 rounded-xl flex items-center justify-between gap-4 transition cursor-pointer ${
                      isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => onOpenRecentPath(item.path)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenRecentPath(item.path);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate group-hover:text-blue-500 transition-colors">
                          {item.title}
                        </div>
                        <div 
                          className={`text-[11px] font-mono truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}
                          title={item.path}
                        >
                          {item.path}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                        {formatRelativeTime(item.lastOpenedAt)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRecent(item.path);
                        }}
                        className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition ${
                          isDark ? 'hover:bg-zinc-700 text-zinc-400 hover:text-red-400' : 'hover:bg-slate-200 text-slate-400 hover:text-red-600'
                        }`}
                        title="从历史记录中移除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Web Mode: Unsaved Drafts */
            drafts.length === 0 ? (
              <div className={`py-10 px-4 rounded-xl border border-dashed text-center flex flex-col items-center justify-center gap-2 ${
                isDark ? 'border-zinc-800 text-zinc-500' : 'border-slate-200 text-slate-400'
              }`}>
                <Check className="w-7 h-7 text-emerald-500 opacity-80" />
                <div className="text-xs font-medium">当前没有本地草稿</div>
                <div className="text-[11px] opacity-70">
                  所有项目已导出为 .sdc 文件或已清空。您可以直接从上方选择模板开始创建。
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {drafts.map((draft) => {
                  return (
                    <div
                      key={draft.documentId}
                      className={`group p-4 rounded-xl border flex flex-col justify-between gap-3 transition ${
                        isDark 
                          ? 'bg-zinc-800/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/70' 
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold tracking-tight truncate group-hover:text-blue-500 transition-colors">
                            {draft.title}
                          </h4>
                          <div className={`text-[11px] mt-1 flex items-center gap-2 ${
                            isDark ? 'text-zinc-500' : 'text-slate-400'
                          }`}>
                            <span>修改于 {formatRelativeTime(draft.updatedAt)}</span>
                            <span>•</span>
                            <span>{draft.themeName}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onDeleteDraft(draft.documentId)}
                          className={`p-1.5 rounded-lg transition shrink-0 ${
                            isDark ? 'hover:bg-zinc-700 text-zinc-500 hover:text-red-400' : 'hover:bg-slate-200 text-slate-400 hover:text-red-600'
                          }`}
                          title="放弃此未保存草稿"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Content stats & action */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/40 dark:border-zinc-800/60">
                        <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                          约 {draft.charCount} 字 / {draft.lineCount} 行
                        </span>

                        <button
                          type="button"
                          onClick={() => onRestoreDraft(draft)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                        >
                          <span>继续编辑</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </section>

      </main>

      {/* Lightbox / Enlarged View for QR Code */}
      {showLargeQrModal && (
        <div 
          className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowLargeQrModal(false)}
        >
          <div 
            className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200 ${
              isDark ? 'bg-[#181818] border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 border-b border-zinc-200/50 dark:border-zinc-800/80">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                <span className="text-sm font-bold">微信赞赏支持</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLargeQrModal(false)}
                className={`p-1 rounded-lg transition ${
                  isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
                }`}
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center">
              <img 
                src="./reward-code.svg" 
                alt="微信赞赏码" 
                className="w-56 h-56 object-contain select-none"
              />
            </div>

            <p className={`text-xs text-center leading-relaxed ${
              isDark ? 'text-zinc-400' : 'text-slate-500'
            }`}>
              打开微信「扫一扫」，赞赏支持开发者（桑榆肖物）<br />
              感谢您的支持与陪伴！
            </p>

            <div className="flex items-center gap-2 w-full pt-1">
              <a 
                href="./reward-code.svg" 
                download="sangdoccraft-wechat-reward.svg"
                className={`flex-1 py-2 rounded-xl border text-xs font-medium text-center transition inline-flex items-center justify-center gap-1.5 ${
                  isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>保存赞赏码</span>
              </a>
              <button
                type="button"
                onClick={() => setShowLargeQrModal(false)}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
