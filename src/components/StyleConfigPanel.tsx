import React, { useState } from 'react';
import { 
  FileText, 
  Heading, 
  Type, 
  Palette, 
  List, 
  Layout, 
  AlignLeft, 
  Settings2, 
  Sliders, 
  Check, 
  ChevronDown, 
  ChevronRight,
  BookOpen,
  Info,
  Upload,
  Trash2,
  Plus,
  RotateCcw,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { DocumentTheme, CoverStyle, FontChoice, CoverListItem } from '../types';
import { updateMarkdownFrontmatter } from '../utils/markdownParser';

interface StyleConfigPanelProps {
  theme: DocumentTheme;
  onChange: (updatedTheme: DocumentTheme) => void;
  uiMode?: 'dark' | 'light';
  markdown?: string;
  onMarkdownChange?: (updatedMarkdown: string) => void;
}

export const StyleConfigPanel: React.FC<StyleConfigPanelProps> = ({ 
  theme, 
  onChange, 
  uiMode = 'dark',
  markdown,
  onMarkdownChange
}) => {
  const [activeTab, setActiveTab] = useState<'cover' | 'headerFooter' | 'toc' | 'style' | 'headingList'>('cover');
  const isDark = uiMode === 'dark';

  // Dynamic theme class helpers for light/dark mode
  const sectionBorderClass = isDark ? 'border-[#2A2A2A]' : 'border-slate-200';
  const labelClass = isDark ? 'text-zinc-400' : 'text-slate-600';
  const textMainClass = isDark ? 'text-white' : 'text-slate-900';
  const textMutedClass = isDark ? 'text-zinc-500' : 'text-slate-500';
  const textSubClass = isDark ? 'text-zinc-300' : 'text-slate-700';

  const cardBgClass = isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-slate-50 border-slate-200';
  const subCardBgClass = isDark ? 'bg-[#141414] border-[#2A2A2A]' : 'bg-white border-slate-200 shadow-2xs';

  const inputClass = isDark
    ? 'bg-[#0A0A0A] border-[#2A2A2A] text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-hidden'
    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden';

  const inputSubClass = isDark
    ? 'bg-[#181818] border-[#2A2A2A] text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-hidden'
    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden';

  const buttonDashedClass = isDark
    ? 'bg-[#1A1A1A] hover:bg-[#252525] border-[#333] text-blue-400'
    : 'bg-white hover:bg-slate-100 border-slate-200 text-blue-600 shadow-2xs';

  // Update helpers with Frontmatter Sync
  const updateMeta = (field: string, val: any) => {
    const newMeta = { ...theme.meta, [field]: val };
    const updatedTheme = {
      ...theme,
      meta: newMeta,
    };
    onChange(updatedTheme);

    if (markdown !== undefined && onMarkdownChange) {
      const updatedMd = updateMarkdownFrontmatter(markdown, newMeta);
      if (updatedMd !== markdown) {
        onMarkdownChange(updatedMd);
      }
    }
  };

  const updateFullMeta = (newMeta: any) => {
    const updatedTheme = {
      ...theme,
      meta: newMeta,
    };
    onChange(updatedTheme);

    if (markdown !== undefined && onMarkdownChange) {
      const updatedMd = updateMarkdownFrontmatter(markdown, newMeta);
      if (updatedMd !== markdown) {
        onMarkdownChange(updatedMd);
      }
    }
  };

  // Cover List Helper
  const currentCoverList: CoverListItem[] = theme.meta.coverlist || [
    { label: '撰写团队', value: theme.meta.author || '' },
    { label: '所属部门', value: theme.meta.department || '' },
  ].filter(item => !!item.value || !!item.label);

  const handleUpdateCoverList = (newList: CoverListItem[]) => {
    updateMeta('coverlist', newList);
  };

  const handleAddCoverListItem = () => {
    const newList = [...currentCoverList, { label: '自定义项', value: '' }];
    handleUpdateCoverList(newList);
  };

  const handleEditCoverListItem = (index: number, key: 'label' | 'value', val: string) => {
    const newList = [...currentCoverList];
    newList[index] = { ...newList[index], [key]: val };
    handleUpdateCoverList(newList);
  };

  const handleRemoveCoverListItem = (index: number) => {
    const newList = currentCoverList.filter((_, i) => i !== index);
    handleUpdateCoverList(newList);
  };

  const handleResetCoverList = () => {
    const defaultList: CoverListItem[] = [
      { label: '撰写团队', value: theme.meta.author || '核心团队' },
      { label: '所属部门', value: theme.meta.department || '技术委员会' },
      { label: '备注', value: '请在此填写交付信息' },
    ];
    handleUpdateCoverList(defaultList);
  };

  const updateHeader = (field: string, val: any) => {
    onChange({
      ...theme,
      header: { ...theme.header, [field]: val },
    });
  };

  const updateFooter = (field: string, val: any) => {
    onChange({
      ...theme,
      footer: { ...theme.footer, [field]: val },
    });
  };

  const updateToc = (field: string, val: any) => {
    onChange({
      ...theme,
      toc: { ...theme.toc, [field]: val },
    });
  };

  const updateStyle = (field: string, val: any) => {
    onChange({
      ...theme,
      style: { ...theme.style, [field]: val },
    });
  };

  const tabInactiveClass = isDark 
    ? 'text-zinc-400 hover:text-white hover:bg-[#2A2A2A]' 
    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80';

  return (
    <div className={`border-l h-full flex flex-col overflow-hidden text-xs transition-colors duration-200 ${
      isDark ? 'bg-[#181818] border-[#2A2A2A] text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
    }`}>
      
      {/* Tab Selector Header */}
      <div className={`flex items-center border-b p-1.5 gap-1 shrink-0 ${
        isDark ? 'border-[#2A2A2A] bg-[#0A0A0A]' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          <button
            onClick={() => setActiveTab('cover')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition shrink-0 ${
              activeTab === 'cover' ? 'bg-blue-600 text-white shadow-xs' : tabInactiveClass
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>封面</span>
          </button>

          <button
            onClick={() => setActiveTab('headerFooter')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition shrink-0 ${
              activeTab === 'headerFooter' ? 'bg-blue-600 text-white shadow-xs' : tabInactiveClass
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>页眉页脚</span>
          </button>

          <button
            onClick={() => setActiveTab('toc')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition shrink-0 ${
              activeTab === 'toc' ? 'bg-blue-600 text-white shadow-xs' : tabInactiveClass
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>目录</span>
          </button>

          <button
            onClick={() => setActiveTab('style')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition shrink-0 ${
              activeTab === 'style' ? 'bg-blue-600 text-white shadow-xs' : tabInactiveClass
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>配色</span>
          </button>

          <button
            onClick={() => setActiveTab('headingList')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition shrink-0 ${
              activeTab === 'headingList' ? 'bg-blue-600 text-white shadow-xs' : tabInactiveClass
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>列表</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* TAB 1: COVER PAGE SETTINGS */}
        {activeTab === 'cover' && (
          <div className="space-y-4">
            <div className={`flex items-center justify-between pb-2 border-b ${sectionBorderClass}`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${labelClass}`}>
                <FileText className="w-4 h-4 text-blue-500" />
                标准封面布局设置
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={theme.meta.showCover}
                  onChange={(e) => updateMeta('showCover', e.target.checked)}
                  className={`rounded text-blue-600 focus:ring-blue-500 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                />
                <span className={`font-bold text-[11px] ${textSubClass}`}>生成首页封面</span>
              </label>
            </div>

            {theme.meta.showCover && (
              <div className="space-y-4">
                {/* Visual Cover Style Picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>
                      封面视觉模版 (Cover Style)
                    </label>
                    <span className="text-[10px] text-blue-400 font-medium">点击效果卡片实时预览</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: 'enterprise', name: '🏢 企业经典', desc: '经典居中与元数据表' },
                      { id: 'modern', name: '💻 科技现代', desc: '侧边深色条纹与卡片' },
                      { id: 'spec', name: '📜 政企规范', desc: '双边框与文件编号' },
                      { id: 'minimal', name: '🌿 极简黑白', desc: '高雅留白与纤细字号' },
                      { id: 'creative', name: '🎨 现代渐变', desc: '渐变 Banner 与图示卡片' },
                    ].map((opt) => {
                      const isSelected = (theme.meta.coverStyle || 'enterprise') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateMeta('coverStyle', opt.id as CoverStyle)}
                          className={`group flex flex-col p-2 rounded-lg border text-left transition-all relative overflow-hidden ${
                            isSelected
                              ? 'border-2 border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10 shadow-md'
                              : isDark
                              ? 'border-[#2A2A2A] bg-[#0D0D0D] hover:border-zinc-500 hover:bg-[#141414]'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                          }`}
                        >
                          {/* Selected Checkmark Badge */}
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center z-10 shadow-xs">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}

                          {/* Mini Layout Canvas Thumbnail */}
                          <div className="w-full aspect-[3/4] bg-white rounded border border-slate-200 shadow-xs p-1.5 flex flex-col justify-between overflow-hidden relative mb-2 select-none group-hover:scale-[1.02] transition-transform">
                            {opt.id === 'enterprise' && (
                              <div className="h-full flex flex-col justify-between items-center text-center py-1">
                                <div className="w-8 h-1 rounded-full bg-blue-500/30" />
                                <div className="space-y-0.5 my-auto">
                                  <div className="w-12 h-1.5 bg-slate-800 rounded mx-auto" />
                                  <div className="w-8 h-1 bg-blue-500 rounded mx-auto" />
                                  <div className="w-4 h-0.5 bg-blue-500 rounded mx-auto mt-1" />
                                </div>
                                <div className="w-full space-y-0.5 px-0.5">
                                  <div className="h-0.5 bg-slate-200 w-full" />
                                  <div className="h-0.5 bg-slate-200 w-full" />
                                  <div className="h-0.5 bg-slate-200 w-full" />
                                </div>
                              </div>
                            )}

                            {opt.id === 'modern' && (
                              <div className="h-full flex flex-col justify-between p-0.5 border-l-2 border-l-blue-600">
                                <div className="flex justify-between items-center">
                                  <div className="w-5 h-0.5 bg-slate-400 rounded-xs" />
                                  <div className="w-3 h-1 bg-blue-500 rounded-full" />
                                </div>
                                <div className="space-y-0.5 my-auto">
                                  <div className="w-14 h-2 bg-slate-900 rounded-xs" />
                                  <div className="w-8 h-1 bg-blue-500 rounded-xs" />
                                  <div className="w-5 h-0.5 bg-blue-500 rounded-xs mt-0.5" />
                                </div>
                                <div className="w-full h-3 bg-slate-100 rounded-xs p-0.5 space-y-0.5">
                                  <div className="h-0.5 bg-slate-300 w-3/4" />
                                  <div className="h-0.5 bg-slate-300 w-1/2" />
                                </div>
                              </div>
                            )}

                            {opt.id === 'spec' && (
                              <div className="h-full border border-double border-slate-700 p-0.5 flex flex-col justify-between">
                                <div className="text-center border-b border-slate-200 pb-0.5">
                                  <div className="w-8 h-0.5 bg-slate-600 mx-auto" />
                                </div>
                                <div className="text-center space-y-0.5 my-auto">
                                  <div className="w-6 h-0.5 bg-slate-300 mx-auto" />
                                  <div className="w-12 h-1.5 bg-slate-900 mx-auto" />
                                  <div className="w-8 h-1 bg-red-600 mx-auto" />
                                </div>
                                <div className="w-full h-2.5 bg-slate-50 border border-slate-200 rounded-xs p-0.5">
                                  <div className="h-0.5 bg-slate-300 w-full" />
                                </div>
                              </div>
                            )}

                            {opt.id === 'minimal' && (
                              <div className="h-full flex flex-col justify-between p-1 text-left">
                                <div className="w-5 h-0.5 bg-slate-300" />
                                <div className="space-y-0.5 my-auto">
                                  <div className="w-14 h-1.5 bg-slate-800" />
                                  <div className="w-8 h-0.5 bg-slate-400" />
                                  <div className="w-4 h-px bg-slate-300 mt-1" />
                                </div>
                                <div className="space-y-0.5">
                                  <div className="w-8 h-0.5 bg-slate-400" />
                                  <div className="w-6 h-0.5 bg-slate-300" />
                                </div>
                              </div>
                            )}

                            {opt.id === 'creative' && (
                              <div className="h-full flex flex-col justify-between p-0.5">
                                <div className="w-full h-6 rounded-xs bg-gradient-to-br from-purple-600 to-blue-500 p-1">
                                  <div className="w-8 h-1 bg-white/90 rounded-xs" />
                                  <div className="w-5 h-0.5 bg-white/70 rounded-xs mt-0.5" />
                                </div>
                                <div className="grid grid-cols-2 gap-0.5 my-auto w-full">
                                  <div className="h-2 bg-slate-100 rounded-xs" />
                                  <div className="h-2 bg-slate-100 rounded-xs" />
                                  <div className="h-2 bg-slate-100 rounded-xs" />
                                  <div className="h-2 bg-slate-100 rounded-xs" />
                                </div>
                                <div className="w-8 h-0.5 bg-slate-300 mx-auto" />
                              </div>
                            )}
                          </div>

                          {/* Option Details */}
                          <div className="w-full">
                            <div className={`text-[11px] font-bold truncate ${
                              isSelected 
                                ? 'text-emerald-500 font-extrabold' 
                                : textSubClass
                            }`}>
                              {opt.name}
                            </div>
                            <div className={`text-[9px] truncate ${textMutedClass}`}>
                              {opt.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`grid grid-cols-1 gap-3 pt-3 border-t ${sectionBorderClass}`}>
                  {/* Title & Subtitle */}
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>文档标题 (Title)</label>
                    <input
                      type="text"
                      value={theme.meta.title || ''}
                      onChange={(e) => updateMeta('title', e.target.value)}
                      placeholder="如：企业级微服务重构方案"
                      className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>副标题 (Subtitle)</label>
                    <input
                      type="text"
                      value={theme.meta.subtitle || ''}
                      onChange={(e) => updateMeta('subtitle', e.target.value)}
                      placeholder="如：高可用分层架构与分布式白皮书"
                      className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                    />
                  </div>

                  {/* Document Number & Organization */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>文档编号 (Doc No.)</label>
                      <input
                        type="text"
                        value={theme.meta.number || ''}
                        onChange={(e) => updateMeta('number', e.target.value)}
                        placeholder="如：TSRH-TL-RRep-01"
                        className={`w-full rounded px-2.5 py-1.5 font-mono text-[11px] ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>所属机构 / 公司</label>
                      <input
                        type="text"
                        value={theme.meta.organization || ''}
                        onChange={(e) => updateMeta('organization', e.target.value)}
                        placeholder="如：架构委员会"
                        className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                      />
                    </div>
                  </div>

                  {/* Document Logo Management */}
                  <div className={`p-3 rounded-lg border space-y-2 ${cardBgClass}`}>
                    <div className="flex items-center justify-between">
                      <label className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${labelClass}`}>
                        <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                        文档标志 Logo
                      </label>
                      {(theme.meta.logo || theme.meta.logoUrl) && (
                        <button
                          type="button"
                          onClick={() => {
                            updateFullMeta({
                              ...theme.meta,
                              logo: '',
                              logoUrl: '',
                            });
                          }}
                          className="text-[10px] text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          清除 Logo
                        </button>
                      )}
                    </div>

                    {(theme.meta.logo || theme.meta.logoUrl) && (
                      <div className={`flex items-center gap-3 p-2 rounded border ${subCardBgClass}`}>
                        <img
                          src={theme.meta.logo || theme.meta.logoUrl}
                          alt="Logo Preview"
                          className="h-8 max-w-[120px] object-contain bg-slate-100/50 p-1 rounded"
                        />
                        <span className="text-[10px] text-emerald-600 font-bold truncate font-mono">已加载 Logo 图片</span>
                      </div>
                    )}

                    <div className="pt-1">
                      <input
                        type="text"
                        value={theme.meta.logo || theme.meta.logoUrl || ''}
                        onChange={(e) => {
                          updateFullMeta({
                            ...theme.meta,
                            logo: e.target.value,
                            logoUrl: e.target.value,
                          });
                        }}
                        placeholder="输入图片 URL 或本地相对路径 (如: ./assets/logo.png)"
                        className={`w-full rounded px-2.5 py-1.5 text-[11px] ${inputClass}`}
                      />
                    </div>
                  </div>

                  {/* Custom Cover List Editor */}
                  <div className={`p-3 rounded-lg border space-y-3 ${cardBgClass}`}>
                    <div className={`flex items-center justify-between pb-2 border-b ${sectionBorderClass}`}>
                      <div className="flex items-center gap-1.5">
                        <List className="w-3.5 h-3.5 text-blue-500" />
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${textSubClass}`}>
                          封面属性字段列表 (Cover Metadata List)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetCoverList}
                        className={`text-[10px] flex items-center gap-1 transition font-medium ${textMutedClass} hover:${textMainClass}`}
                        title="从经典属性重置"
                      >
                        <RotateCcw className="w-3 h-3" />
                        重置默认
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {currentCoverList.length === 0 ? (
                        <div className={`text-center py-4 text-[11px] ${textMutedClass}`}>
                          暂无属性字段，点击下方按钮添加
                        </div>
                      ) : (
                        currentCoverList.map((item, idx) => (
                          <div key={idx} className={`flex items-center gap-2 p-1.5 rounded border ${subCardBgClass}`}>
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) => handleEditCoverListItem(idx, 'label', e.target.value)}
                              placeholder="标签 (如: 项目名称)"
                              className={`w-32 sm:w-36 shrink-0 rounded px-2 py-1 text-[11px] font-medium ${inputClass}`}
                            />
                            <span className={`${textMutedClass} shrink-0 font-bold`}>:</span>
                            <input
                              type="text"
                              value={item.value}
                              onChange={(e) => handleEditCoverListItem(idx, 'value', e.target.value)}
                              placeholder="内容 (如: Project Hyperion)"
                              className={`flex-1 min-w-0 rounded px-2 py-1 text-[11px] ${inputClass}`}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveCoverListItem(idx)}
                              className={`p-1.5 transition shrink-0 rounded hover:bg-red-500/10 ${textMutedClass} hover:text-red-500`}
                              title="删除此行"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCoverListItem}
                      className={`w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed rounded font-medium text-[11px] transition ${buttonDashedClass}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加自定义属性行
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HEADER & FOOTER SETTINGS */}
        {activeTab === 'headerFooter' && (
          <div className="space-y-5">
            {/* Header Settings */}
            <div className={`space-y-3 p-3 rounded-lg border ${cardBgClass}`}>
              <div className={`flex items-center justify-between pb-1 border-b ${sectionBorderClass}`}>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${textMainClass}`}>页眉信息设置</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={theme.header.show}
                    onChange={(e) => updateHeader('show', e.target.checked)}
                    className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                  />
                  <span className={`font-bold text-[11px] ${textSubClass}`}>显示页眉</span>
                </label>
              </div>

              {theme.header.show && (
                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>左侧文本 (如项目名)</label>
                    <input
                      type="text"
                      value={theme.header.leftText}
                      onChange={(e) => updateHeader('leftText', e.target.value)}
                      className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>中间文本</label>
                    <input
                      type="text"
                      value={theme.header.centerText}
                      onChange={(e) => updateHeader('centerText', e.target.value)}
                      className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>右侧文本 (如文档名/保密标记)</label>
                    <input
                      type="text"
                      value={theme.header.rightText}
                      onChange={(e) => updateHeader('rightText', e.target.value)}
                      className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>分隔分割线</label>
                      <select
                        value={theme.header.lineStyle}
                        onChange={(e) => updateHeader('lineStyle', e.target.value)}
                        className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                      >
                        <option value="solid">单实线 (Solid)</option>
                        <option value="accent">主题高亮线 (Accent)</option>
                        <option value="double">双重公文线 (Double)</option>
                        <option value="none">无分割线</option>
                      </select>
                    </div>
                    <div className="flex items-end pb-1">
                      <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${labelClass}`}>
                        <input
                          type="checkbox"
                          checked={theme.header.hideOnCover}
                          onChange={(e) => updateHeader('hideOnCover', e.target.checked)}
                          className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                        />
                        <span>封面隐藏页眉</span>
                      </label>
                    </div>
                  </div>

                  <div className={`pt-2 border-t ${sectionBorderClass} space-y-2`}>
                    <div className="flex items-center justify-between">
                      <label className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${labelClass}`}>
                        <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                        页眉 Logo
                      </label>
                      {theme.header.logoUrl && (
                        <button
                          type="button"
                          onClick={() => updateHeader('logoUrl', '')}
                          className="text-[10px] text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          清除 Logo
                        </button>
                      )}
                    </div>
                    {theme.header.logoUrl && (
                      <div className={`flex items-center gap-3 p-2 rounded border ${subCardBgClass}`}>
                        <img
                          src={theme.header.logoUrl}
                          alt="Header Logo Preview"
                          className="h-8 w-auto object-contain bg-slate-100/50 p-1 rounded"
                        />
                        <span className="text-[10px] text-emerald-600 font-bold truncate font-mono">已加载 Logo 图片</span>
                      </div>
                    )}
                    <div>
                      <input
                        type="text"
                        value={theme.header.logoUrl || ''}
                        onChange={(e) => updateHeader('logoUrl', e.target.value)}
                        placeholder="输入图片 URL 或本地相对路径 (如: ./assets/logo.png)"
                        className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                      />
                    </div>
                    {theme.header.logoUrl && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <div className={`flex justify-between text-[10px] font-bold mb-1 ${labelClass}`}>
                            <span>Logo 高度 (px)</span>
                            <span>{theme.header.logoHeight ?? 20}px</span>
                          </div>
                          <input
                            type="range"
                            min={10}
                            max={70}
                            value={theme.header.logoHeight ?? 20}
                            onChange={(e) => updateHeader('logoHeight', Number(e.target.value))}
                            className="w-full accent-blue-600"
                          />
                        </div>
                        <div>
                          <div className={`flex justify-between text-[10px] font-bold mb-1 ${labelClass}`}>
                            <span>Logo 透明度 (%)</span>
                            <span>{Math.round((theme.header.logoOpacity ?? 1) * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={10}
                            max={100}
                            value={Math.round((theme.header.logoOpacity ?? 1) * 100)}
                            onChange={(e) => updateHeader('logoOpacity', Math.min(1, Math.max(0, Number(e.target.value) / 100)))}
                            className="w-full accent-blue-600"
                          />
                        </div>
                        <div>
                          <div className={`flex justify-between text-[10px] font-bold mb-1 ${labelClass}`}>
                            <span>左侧文本偏移 (px)</span>
                            <span>{theme.header.leftTextOffset ?? 0}px</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={400}
                            value={theme.header.leftTextOffset ?? 0}
                            onChange={(e) => updateHeader('leftTextOffset', Number(e.target.value))}
                            className="w-full accent-blue-600"
                          />
                        </div>
                        <div>
                          <div className={`flex justify-between text-[10px] font-bold mb-1 ${labelClass}`}>
                            <span>Logo 顶部距离 (px)</span>
                            <span>{theme.header.logoTopOffset ?? 15}px</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={120}
                            value={theme.header.logoTopOffset ?? 15}
                            onChange={(e) => updateHeader('logoTopOffset', Number(e.target.value))}
                            className="w-full accent-blue-600"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer & Page Number Settings */}
            <div className={`space-y-3 p-3 rounded-lg border ${cardBgClass}`}>
              <div className={`flex items-center justify-between pb-1 border-b ${sectionBorderClass}`}>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${textMainClass}`}>页脚与页码设置</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={theme.footer.show}
                    onChange={(e) => updateFooter('show', e.target.checked)}
                    className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                  />
                  <span className={`font-bold text-[11px] ${textSubClass}`}>显示页脚</span>
                </label>
              </div>

              {theme.footer.show && (
                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>左侧页脚声明 (如版权/保密)</label>
                    <input
                      type="text"
                      value={theme.footer.leftText}
                      onChange={(e) => updateFooter('leftText', e.target.value)}
                      className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>中间文本</label>
                      <input
                        type="text"
                        value={theme.footer.centerText}
                        onChange={(e) => updateFooter('centerText', e.target.value)}
                        className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>右侧文本</label>
                      <input
                        type="text"
                        value={theme.footer.rightText}
                        onChange={(e) => updateFooter('rightText', e.target.value)}
                        className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>页码样式格式</label>
                      <select
                        value={theme.footer.pageNumberFormat}
                        onChange={(e) => updateFooter('pageNumberFormat', e.target.value)}
                        className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                      >
                        <option value="pageOfTotal">第 X 页 / 共 Y 页</option>
                        <option value="page">第 X 页</option>
                        <option value="hyphen">- X -</option>
                        <option value="simple">X / Y</option>
                        <option value="none">不显示页码 (无)</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>页码对齐位置</label>
                      <select
                        value={theme.footer.pageNumberPosition}
                        onChange={(e) => updateFooter('pageNumberPosition', e.target.value)}
                        className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                      >
                        <option value="right">右对齐</option>
                        <option value="center">居中对齐</option>
                        <option value="left">左对齐</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between border-t border-dashed border-slate-200/50 mt-2">
                    <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${labelClass}`}>
                      <input
                        type="checkbox"
                        checked={theme.footer.hideOnCover !== false}
                        onChange={(e) => updateFooter('hideOnCover', e.target.checked)}
                        className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                      />
                      <span>封面隐藏页脚</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TOC SETTINGS */}
        {activeTab === 'toc' && (
          <div className="space-y-4">
            <div className={`flex items-center justify-between pb-2 border-b ${sectionBorderClass}`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${labelClass}`}>
                <BookOpen className="w-4 h-4 text-blue-500" />
                自动生成目录页 (Table of Contents)
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={theme.toc.show}
                  onChange={(e) => updateToc('show', e.target.checked)}
                  className={`rounded text-blue-600 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                />
                <span className={`font-bold text-[11px] ${textSubClass}`}>生成目录页</span>
              </label>
            </div>

            {theme.toc.show && (
              <div className="space-y-3">
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>目录页标题</label>
                  <input
                    type="text"
                    value={theme.toc.title}
                    onChange={(e) => updateToc('title', e.target.value)}
                    className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>提取标题深度</label>
                    <select
                      value={theme.toc.maxDepth}
                      onChange={(e) => updateToc('maxDepth', Number(e.target.value))}
                      className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                    >
                      <option value={1}>仅一级标题 H1</option>
                      <option value={2}>一、二级标题 H1-H2</option>
                      <option value={3}>一、二、三级标题 H1-H3</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>目录引导线样式</label>
                    <select
                      value={theme.toc.leaderStyle}
                      onChange={(e) => updateToc('leaderStyle', e.target.value)}
                      className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                    >
                      <option value="dots">点线 . . . . . . . .</option>
                      <option value="dashes">虚线 - - - - - - -</option>
                      <option value="line">实线 ——————</option>
                      <option value="none">无引导线</option>
                    </select>
                  </div>
                </div>

                <div className={`pt-2 border-t ${sectionBorderClass}`}>
                  <label className={`flex items-center gap-2 cursor-pointer font-bold text-[11px] mb-2 ${textSubClass}`}>
                    <input
                      type="checkbox"
                      checked={theme.toc.showPageNumbers}
                      onChange={(e) => updateToc('showPageNumbers', e.target.checked)}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>显示目录页码</span>
                  </label>
                  <label className={`flex items-center gap-2 cursor-pointer font-bold text-[11px] ${textSubClass}`}>
                    <input
                      type="checkbox"
                      checked={theme.toc.pageBreakAfter}
                      onChange={(e) => updateToc('pageBreakAfter', e.target.checked)}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>目录后强行独占分页</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: COLORS & TYPOGRAPHY */}
        {activeTab === 'style' && (
          <div className="space-y-4">
            <div className={`pb-2 border-b text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${sectionBorderClass} ${labelClass}`}>
              <Palette className="w-4 h-4 text-blue-500" />
              文档全局配色与字体设定
            </div>

            {/* Quick Color Presets in Visual Card Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`block text-[10px] font-bold uppercase tracking-widest ${labelClass}`}>
                  配色方案 (Color Schemes)
                </label>
                <span className={`text-[10px] ${textMutedClass}`}>选择预设主题色彩</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: '深蓝商务', primary: '#0f172a', accent: '#2563eb', bg: '#f8fafc' },
                  { name: '科技蔚蓝', primary: '#0369a1', accent: '#0284c7', bg: '#f0f9ff' },
                  { name: '政企朱红', primary: '#881337', accent: '#e11d48', bg: '#fff1f2' },
                  { name: '极简暗黑', primary: '#18181b', accent: '#52525b', bg: '#f4f4f5' },
                  { name: '典雅紫罗兰', primary: '#4c1d95', accent: '#7c3aed', bg: '#f5f3ff' },
                  { name: '生机翡翠', primary: '#064e3b', accent: '#059669', bg: '#ecfdf5' },
                  { name: '暖调琥珀', primary: '#451a03', accent: '#d97706', bg: '#fffbeb' },
                  { name: '静谧黛青', primary: '#134e4a', accent: '#0d9488', bg: '#f0fdfa' },
                  { name: '现代高雅', primary: '#1c1917', accent: '#ea580c', bg: '#fafaf9' },
                ].map((c) => {
                  const isSelected = 
                    theme.style.primaryColor.toLowerCase() === c.primary.toLowerCase() &&
                    theme.style.accentColor.toLowerCase() === c.accent.toLowerCase();
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        onChange({
                          ...theme,
                          style: {
                            ...theme.style,
                            primaryColor: c.primary,
                            accentColor: c.accent,
                          },
                        });
                      }}
                      className={`group flex flex-col p-1.5 rounded-lg text-left transition relative border ${
                        isSelected
                          ? 'border-2 border-blue-500 ring-2 ring-blue-500/30 bg-blue-500/10 shadow-sm'
                          : isDark
                          ? 'border-[#2A2A2A] bg-[#0A0A0A] hover:border-zinc-500'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                      }`}
                    >
                      {/* Selected Check Indicator */}
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center z-10 shadow-sm">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}

                      {/* Mini Preview Box matching attachment screenshot */}
                      <div className="w-full h-12 bg-slate-100 rounded border border-slate-200/80 flex overflow-hidden relative mb-1 select-none">
                        {/* Left Primary Color Bar */}
                        <div className="w-1/3 h-full flex flex-col justify-between p-0.5" style={{ backgroundColor: c.primary }}>
                          <div className="w-full h-1 rounded-xs bg-white/40" />
                          <div className="w-2/3 h-0.5 rounded-xs bg-white/30" />
                        </div>
                        {/* Right Content Area with Accent Bar */}
                        <div className="w-2/3 h-full p-1 flex flex-col justify-between" style={{ backgroundColor: c.bg }}>
                          <div className="w-full h-1.5 rounded-xs" style={{ backgroundColor: c.accent }} />
                          <div className="space-y-0.5">
                            <div className="w-full h-0.5 bg-slate-300 rounded-xs" />
                            <div className="w-3/4 h-0.5 bg-slate-300 rounded-xs" />
                          </div>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold truncate text-center w-full ${
                        isSelected ? 'text-blue-500 font-extrabold' : textSubClass
                      }`}>
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>段落英文字体</label>
              <input
                type="text"
                value={theme.style.latinFontFamily || 'Times New Roman'}
                onChange={(e) => updateStyle('latinFontFamily', e.target.value)}
                placeholder="Times New Roman"
                className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>主色调 (Primary Color)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={theme.style.primaryColor}
                    onChange={(e) => updateStyle('primaryColor', e.target.value)}
                    className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={theme.style.primaryColor}
                    onChange={(e) => updateStyle('primaryColor', e.target.value)}
                    className={`flex-1 rounded px-2 py-1 uppercase font-mono text-xs ${inputClass}`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>辅色调 (Accent Color)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={theme.style.accentColor}
                    onChange={(e) => updateStyle('accentColor', e.target.value)}
                    className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={theme.style.accentColor}
                    onChange={(e) => updateStyle('accentColor', e.target.value)}
                    className={`flex-1 rounded px-2 py-1 uppercase font-mono text-xs ${inputClass}`}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>字体簇选择 (Font Family)</label>
              <select
                value={theme.style.fontFamily}
                onChange={(e) => updateStyle('fontFamily', e.target.value as FontChoice)}
                className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
              >
                <option value="sans">无衬线黑体 (Sans-serif - 现代化/清晰)</option>
                <option value="serif">衬线宋体 (Songti - 规范公文/书籍)</option>
                <option value="kaiti">典雅楷体 (KaiTi - 传统公文/书法)</option>
                <option value="heiti">重黑体 (HeiTi - 高强对比/醒目)</option>
                <option value="mono">等宽技术体 (Monospace - 极客/研发)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>正文字号 (px)</label>
                <input
                  type="number"
                  min={12}
                  max={18}
                  value={theme.style.fontSize}
                  onChange={(e) => updateStyle('fontSize', Number(e.target.value))}
                  className={`w-full rounded px-2 py-1 ${inputClass}`}
                />
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>行高倍数</label>
                <input
                  type="number"
                  step={0.1}
                  min={1.2}
                  max={2.2}
                  value={theme.style.lineHeight}
                  onChange={(e) => updateStyle('lineHeight', Number(e.target.value))}
                  className={`w-full rounded px-2 py-1 ${inputClass}`}
                />
              </div>
            </div>

            {/* Paragraph First Line Indent 2 Chars Toggle */}
            <div className={`p-2.5 rounded-lg border ${subCardBgClass}`}>
              <label className={`flex items-center gap-2 cursor-pointer font-bold text-[11px] ${textSubClass}`}>
                <input
                  type="checkbox"
                  checked={theme.style.indentParagraph === true}
                  onChange={(e) => updateStyle('indentParagraph', e.target.checked)}
                  className={`rounded text-blue-600 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                />
                <span>正文段落首行缩进 2 字符 (text-indent: 2em)</span>
              </label>
              <p className={`text-[10px] mt-1 pl-5.5 ${textMutedClass}`}>
                开启后，所有正文段落 (&lt;p&gt;) 将在每段开头自动缩进 2 个字符宽度
              </p>
            </div>
          </div>
        )}

        {/* TAB 5: HEADING & LIST STYLES */}
        {activeTab === 'headingList' && (
          <div className="space-y-4">
            <div className={`pb-2 border-b text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${sectionBorderClass} ${labelClass}`}>
              <List className="w-4 h-4 text-blue-500" />
              标题与 List 列表外观定制
            </div>

            <div className="space-y-3">
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>一级标题 (H1) 表达形式</label>
                <select
                  value={theme.style.h1Style}
                  onChange={(e) => updateStyle('h1Style', e.target.value)}
                  className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                >
                  <option value="underline">底部粗线条 (Bottom Underline)</option>
                  <option value="accent-block">左侧色块标志 (Left Accent Block)</option>
                  <option value="badge">背景色徽章块 (Background Badge)</option>
                  <option value="minimal">极简粗体 (Minimal Bold)</option>
                </select>
              </div>

              {/* H1 Page Break Setting Toggle */}
              <div className={`p-2.5 rounded-lg border ${subCardBgClass}`}>
                <label className={`flex items-center gap-2 cursor-pointer font-bold text-[11px] ${textSubClass}`}>
                  <input
                    type="checkbox"
                    checked={theme.style.h1PageBreak === true}
                    onChange={(e) => updateStyle('h1PageBreak', e.target.checked)}
                    className={`rounded text-blue-600 ${isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                  />
                  <span>一级标题另起一页 (强制独占新页)</span>
                </label>
                <p className={`text-[10px] mt-1 pl-5.5 ${textMutedClass}`}>
                  开启后，每个一级标题 (# Heading 1) 将自动独占一页开头（默认关闭，由手动 pagebreak 决定分页）
                </p>
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>二级标题 (H2) 表达形式</label>
                <select
                  value={theme.style.h2Style}
                  onChange={(e) => updateStyle('h2Style', e.target.value)}
                  className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                >
                  <option value="border-left">左边框竖条 (Left Border Bar)</option>
                  <option value="underline-subtle">细下划线 (Subtle Underline)</option>
                  <option value="plain">普通纯文字 (Plain)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>无序列表项目图标</label>
                  <select
                    value={theme.style.bulletStyle}
                    onChange={(e) => updateStyle('bulletStyle', e.target.value)}
                    className={`w-full rounded px-2 py-1 ${inputClass}`}
                  >
                    <option value="square">实心方块 ■</option>
                    <option value="dot">经典圆点 •</option>
                    <option value="checkmark">对勾符号 ✓</option>
                    <option value="arrow">箭头符号 ▸</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>代码块排版主题</label>
                  <select
                    value={theme.style.codeTheme}
                    onChange={(e) => updateStyle('codeTheme', e.target.value)}
                    className={`w-full rounded px-2 py-1 ${inputClass}`}
                  >
                    <option value="dark">Dark 极客黑深色</option>
                    <option value="light">Light 浅色纸质</option>
                    <option value="github">GitHub 极简灰</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>表格排版样式</label>
                <select
                  value={theme.style.tableStyle}
                  onChange={(e) => updateStyle('tableStyle', e.target.value)}
                  className={`w-full rounded px-2.5 py-1.5 ${inputClass}`}
                >
                  <option value="striped">斑马纹交替 (Striped)</option>
                  <option value="bordered">全网格边框 (Bordered Grid)</option>
                  <option value="minimal">无垂直边框极简 (Minimal)</option>
                </select>
              </div>

              {/* 图片边框与题注配置 */}
              <div className={`p-3 rounded-lg border space-y-3 ${cardBgClass}`}>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${textMainClass}`}>🖼️ 图片边框与题注设置 (Image Captions)</span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>图片边框样式</label>
                    <select
                      value={theme.style.imageConfig?.borderStyle || 'subtle'}
                      onChange={(e) => updateStyle('imageConfig', { ...(theme.style.imageConfig || {}), borderStyle: e.target.value })}
                      className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                    >
                      <option value="none">无边框 (None)</option>
                      <option value="subtle">精致微阴影 (Subtle)</option>
                      <option value="solid">单实线边框 (Solid Line)</option>
                      <option value="shadow">悬浮深阴影 (Deep Shadow)</option>
                      <option value="card">浅色卡片衬底 (Card)</option>
                      <option value="rounded">大圆边框 (Rounded)</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>编号前缀</label>
                    <input
                      type="text"
                      value={theme.style.imageConfig?.numberPrefix ?? '图 '}
                      onChange={(e) => updateStyle('imageConfig', { ...(theme.style.imageConfig || {}), numberPrefix: e.target.value })}
                      className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                      placeholder="如: 图 "
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${labelClass}`}>
                    <input
                      type="checkbox"
                      checked={theme.style.imageConfig?.showCaption !== false}
                      onChange={(e) => updateStyle('imageConfig', { ...(theme.style.imageConfig || {}), showCaption: e.target.checked })}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>显示图片题注</span>
                  </label>

                  <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${labelClass}`}>
                    <input
                      type="checkbox"
                      checked={theme.style.imageConfig?.autoNumber !== false}
                      onChange={(e) => updateStyle('imageConfig', { ...(theme.style.imageConfig || {}), autoNumber: e.target.checked })}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>自动递增编号 (图 1, 图 2...)</span>
                  </label>
                </div>
              </div>

              {/* 表格题注配置 */}
              <div className={`p-3 rounded-lg border space-y-3 ${cardBgClass}`}>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${textMainClass}`}>📊 表格题注设置 (Table Captions)</span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>题注位置</label>
                    <select
                      value={theme.style.tableCaptionConfig?.captionPosition || 'top'}
                      onChange={(e) => updateStyle('tableCaptionConfig', { ...(theme.style.tableCaptionConfig || {}), captionPosition: e.target.value })}
                      className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                    >
                      <option value="top">表格上方 (Top)</option>
                      <option value="bottom">表格下方 (Bottom)</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>编号前缀</label>
                    <input
                      type="text"
                      value={theme.style.tableCaptionConfig?.numberPrefix ?? '表 '}
                      onChange={(e) => updateStyle('tableCaptionConfig', { ...(theme.style.tableCaptionConfig || {}), numberPrefix: e.target.value })}
                      className={`w-full rounded px-2 py-1 ${inputSubClass}`}
                      placeholder="如: 表 "
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${labelClass}`}>
                    <input
                      type="checkbox"
                      checked={theme.style.tableCaptionConfig?.showCaption !== false}
                      onChange={(e) => updateStyle('tableCaptionConfig', { ...(theme.style.tableCaptionConfig || {}), showCaption: e.target.checked })}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>显示表格题注</span>
                  </label>

                  <label className={`flex items-center gap-1.5 cursor-pointer text-[11px] font-bold ${labelClass}`}>
                    <input
                      type="checkbox"
                      checked={theme.style.tableCaptionConfig?.autoNumber !== false}
                      onChange={(e) => updateStyle('tableCaptionConfig', { ...(theme.style.tableCaptionConfig || {}), autoNumber: e.target.checked })}
                      className={`rounded text-blue-600 ${isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-300'}`}
                    />
                    <span>自动递增编号 (表 1, 表 2...)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
