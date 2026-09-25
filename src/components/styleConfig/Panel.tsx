import React, { useState } from 'react';
import { 
  FileText, 
  Type, 
  Palette, 
  Settings2, 
  Sliders, 
  Check, 
  ChevronRight,
  BookOpen,
  Bold,
  Italic,
  Underline,
  X
} from 'lucide-react';
import { DocumentAsset, DocumentMeta, DocumentTheme, CoverConfig, HeaderConfig, FooterConfig, TocConfig, StyleConfig, ImageStyleConfig, TableCaptionConfig, CoverListItem, HeadingFontStyle, TocLevelStyle, TocTitleFont, WatermarkConfig, MermaidConfig, MermaidCustomColors } from '../../types';
import { getTocLevelStyles, getTocTitleFont } from '../../utils/documentStructure';
import { getWatermarkConfig } from '../../utils/watermark';
import { getMermaidConfig, DEFAULT_MERMAID_CUSTOM_COLORS } from '../../utils/mermaidRenderer';
import { ImagePicker } from '../ImagePicker';
import { CoverTab } from './CoverTab';
import { HeaderFooterTab } from './HeaderFooterTab';
import { TocTab } from './TocTab';
import { ColorsTab } from './ColorsTab';
import { HeadingListTab } from './HeadingListTab';
import { OtherTab } from './OtherTab';
import { PanelTabModel } from './shared';

interface StyleConfigPanelProps {
  theme: DocumentTheme;
  themes: DocumentTheme[];
  customThemeIds: string[];
  onThemeChange: (theme: DocumentTheme) => void;
  meta: DocumentMeta;
  onChange: (updatedTheme: DocumentTheme) => void;
  onMetaChange: (updatedMeta: DocumentMeta) => void;
  assets: DocumentAsset[];
  uiMode?: 'dark' | 'light';
}

export const StyleConfigPanel: React.FC<StyleConfigPanelProps> = ({ 
  theme,
  themes,
  customThemeIds,
  onThemeChange,
  meta,
  onChange,
  onMetaChange,
  assets,
  uiMode = 'dark'
}) => {
  const [activeTab, setActiveTab] = useState<'cover' | 'headerFooter' | 'toc' | 'style' | 'headingList' | 'other'>('cover');
  const [imagePickerTarget, setImagePickerTarget] = useState<'cover' | 'header' | 'watermark'>();
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
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

  const buttonDashedClass = isDark
    ? 'bg-[#1A1A1A] hover:bg-[#252525] border-[#333] text-blue-400'
    : 'bg-white hover:bg-slate-100 border-slate-200 text-blue-600 shadow-2xs';

  const updateMeta = (field: keyof DocumentMeta, value: string | undefined) => {
    onMetaChange({ ...meta, [field]: value });
  };

  const updateCover = <T extends keyof CoverConfig>(field: T, value: CoverConfig[T]) => {
    onChange({
      ...theme,
      cover: { ...theme.cover, [field]: value },
    });
  };

  const currentCoverList: CoverListItem[] = theme.cover.coverlist ?? [];

  const handleUpdateCoverList = (newList: CoverListItem[]) => {
    updateCover('coverlist', newList);
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

  const handleMoveCoverListItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentCoverList.length) return;

    const newList = [...currentCoverList];
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    handleUpdateCoverList(newList);
  };

  const updateHeader = <T extends keyof HeaderConfig>(field: T, val: HeaderConfig[T]) => {
    onChange({
      ...theme,
      header: { ...theme.header, [field]: val },
    });
  };

  const updateFooter = <T extends keyof FooterConfig>(field: T, val: FooterConfig[T]) => {
    onChange({
      ...theme,
      footer: { ...theme.footer, [field]: val },
    });
  };

  const updateToc = <T extends keyof TocConfig>(field: T, val: TocConfig[T]) => {
    onChange({
      ...theme,
      toc: { ...theme.toc, [field]: val },
    });
  };

  const updateTocTitleFont = (field: keyof TocTitleFont, value: string | number | boolean) => {
    updateToc('titleFont', { ...getTocTitleFont(theme.toc), [field]: value });
  };

  const updateTocLevelStyle = (index: number, field: keyof TocLevelStyle, value: string | number | boolean) => {
    const styles = getTocLevelStyles(theme.toc);
    styles[index] = { ...styles[index], [field]: value };
    updateToc('levelStyles', styles);
  };

  /** 目录标题 / 各级目录项的统一折叠设置卡片 */
  const renderTocFontDetails = (
    label: string,
    config: TocTitleFont,
    onUpdate: (field: keyof TocTitleFont, value: string | number | boolean) => void,
    indent?: { value: number; onChange: (value: number) => void },
  ) => (
    <details className={`group rounded-lg border ${subCardBgClass}`}>
      <summary className={`flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-bold [&::-webkit-details-marker]:hidden ${textSubClass}`}>
        <span>{label}</span>
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
      </summary>
      <div className={`border-t p-3 space-y-3 ${sectionBorderClass}`}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="min-w-0">
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>字体</label>
            <input
              type="text"
              value={config.fontFamily}
              onChange={(e) => onUpdate('fontFamily', e.target.value)}
              placeholder="inherit"
              className={`w-full min-w-0 rounded px-2.5 py-1.5 ${inputClass}`}
            />
          </div>
          <div>
            <span className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>字形</span>
            <div role="group" aria-label={`${label}字形`} className="flex gap-1">
              {([
                ['bold', '加粗', Bold],
                ['italic', '倾斜', Italic],
                ['underline', '下划线', Underline],
              ] as const).map(([field, text, Icon]) => {
                const selected = Boolean(config[field]);
                return (
                  <button
                    key={field}
                    type="button"
                    aria-pressed={selected}
                    aria-label={text}
                    title={text}
                    onClick={() => onUpdate(field, !selected)}
                    className={`flex h-8 w-8 items-center justify-center rounded border transition ${selected ? 'border-blue-500 bg-blue-600 text-white' : `${subCardBgClass} ${tabInactiveClass}`}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className={`grid gap-2 ${indent ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <div>
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>字号 (px)</label>
            <input
              type="number"
              min={8}
              max={72}
              value={config.fontSize}
              onChange={(e) => onUpdate('fontSize', Number(e.target.value))}
              className={`w-full rounded px-2 py-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>段前 (px)</label>
            <input
              type="number"
              min={0}
              max={120}
              value={config.marginBefore}
              onChange={(e) => onUpdate('marginBefore', Number(e.target.value))}
              className={`w-full rounded px-2 py-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>段后 (px)</label>
            <input
              type="number"
              min={0}
              max={120}
              value={config.marginAfter}
              onChange={(e) => onUpdate('marginAfter', Number(e.target.value))}
              className={`w-full rounded px-2 py-1 ${inputClass}`}
            />
          </div>
          {indent && (
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>缩进 (px)</label>
              <input
                type="number"
                min={0}
                max={200}
                value={indent.value}
                onChange={(e) => indent.onChange(Number(e.target.value))}
                className={`w-full rounded px-2 py-1 ${inputClass}`}
              />
            </div>
          )}
        </div>
      </div>
    </details>
  );

  const updateStyle = <T extends keyof StyleConfig>(field: T, val: StyleConfig[T]) => {
    onChange({
      ...theme,
      style: { ...theme.style, [field]: val },
    });
  };

  const imageConfig: ImageStyleConfig = {
    borderStyle: 'subtle', showCaption: true, autoNumber: true, numberPrefix: '图 ', captionAlign: 'center',
    ...theme.style.imageConfig,
  };
  const tableCaptionConfig: TableCaptionConfig = {
    showCaption: true, autoNumber: true, numberPrefix: '表 ', captionPosition: 'top', captionAlign: 'center',
    ...theme.style.tableCaptionConfig,
  };

  const currentWatermark = getWatermarkConfig(theme.style);

  const updateWatermark = <T extends keyof WatermarkConfig>(field: T, val: WatermarkConfig[T]) => {
    updateStyle('watermark', {
      ...currentWatermark,
      [field]: val,
    });
  };

  const mermaidConfig = getMermaidConfig(theme);

  const updateMermaid = (updates: Partial<MermaidConfig>) => {
    const current = getMermaidConfig(theme);
    const next: MermaidConfig = {
      ...current,
      ...updates,
      customColors: {
        ...DEFAULT_MERMAID_CUSTOM_COLORS,
        ...current.customColors,
        ...(updates.customColors || {}),
      },
    };
    onChange({
      ...theme,
      mermaid: next,
    });
  };

  const updateCustomColor = (key: keyof MermaidCustomColors, val: string) => {
    const current = getMermaidConfig(theme);
    updateMermaid({
      customColors: {
        ...DEFAULT_MERMAID_CUSTOM_COLORS,
        ...current.customColors,
        [key]: val,
      },
    });
  };

  const updateHeadingFont = (
    level: keyof DocumentTheme['style']['headingFonts'],
    field: keyof HeadingFontStyle,
    value: string | number | boolean,
  ) => {
    onChange({
      ...theme,
      style: {
        ...theme.style,
        headingFonts: {
          ...theme.style.headingFonts,
          [level]: { ...theme.style.headingFonts[level], [field]: value },
        },
      },
    });
  };

  const renderHeadingDetails = (
    level: keyof DocumentTheme['style']['headingFonts'],
    label: string,
  ) => {
    const config = theme.style.headingFonts[level];
    return (
      <details className={`group rounded-lg border ${subCardBgClass}`}>
        <summary className={`flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-bold [&::-webkit-details-marker]:hidden ${textSubClass}`}>
          <span>{label}详细设置</span>
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
        </summary>
        <div className={`border-t p-3 space-y-3 ${sectionBorderClass}`}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="min-w-0">
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>字体</label>
              <input
                type="text"
                value={config.fontFamily}
                onChange={(e) => updateHeadingFont(level, 'fontFamily', e.target.value)}
                placeholder="inherit"
                className={`w-full min-w-0 rounded px-2.5 py-1.5 ${inputClass}`}
              />
            </div>
            <div>
              <span className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>字形</span>
              <div role="group" aria-label={`${label}字形`} className="flex gap-1">
                {([
                  ['bold', '加粗', Bold],
                  ['italic', '倾斜', Italic],
                  ['underline', '下划线', Underline],
                ] as const).map(([field, text, Icon]) => {
                  const selected = Boolean(config[field]);
                  return (
                    <button
                      key={field}
                      type="button"
                      aria-pressed={selected}
                      aria-label={text}
                      title={text}
                      onClick={() => updateHeadingFont(level, field, !selected)}
                      className={`flex h-8 w-8 items-center justify-center rounded border transition ${selected ? 'border-blue-500 bg-blue-600 text-white' : `${subCardBgClass} ${tabInactiveClass}`}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>字号 (px)</label>
              <input
                type="number"
                min={10}
                max={72}
                value={config.fontSize}
                onChange={(e) => updateHeadingFont(level, 'fontSize', Number(e.target.value))}
                className={`w-full rounded px-2 py-1 ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>段前 (px)</label>
              <input
                type="number"
                min={0}
                max={120}
                value={config.marginBefore}
                onChange={(e) => updateHeadingFont(level, 'marginBefore', Number(e.target.value))}
                className={`w-full rounded px-2 py-1 ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1 ${labelClass}`}>段后 (px)</label>
              <input
                type="number"
                min={0}
                max={120}
                value={config.marginAfter}
                onChange={(e) => updateHeadingFont(level, 'marginAfter', Number(e.target.value))}
                className={`w-full rounded px-2 py-1 ${inputClass}`}
              />
            </div>
          </div>
        </div>
      </details>
    );
  };

  const tabInactiveClass = isDark 
    ? 'text-zinc-400 hover:text-white hover:bg-[#2A2A2A]' 
    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80';

  const tabModel: PanelTabModel = {
    theme, meta, isDark, sectionBorderClass, labelClass, textMainClass, textMutedClass, textSubClass,
    cardBgClass, subCardBgClass, inputClass, buttonDashedClass, tabInactiveClass,
    currentCoverList, imageConfig, tableCaptionConfig, currentWatermark, mermaidConfig,
    onChange,
    openThemePicker: () => setIsThemePickerOpen(true),
    openImagePicker: setImagePickerTarget,
    updateMeta, updateCover, updateHeader, updateFooter, updateToc, updateStyle, updateWatermark,
    updateMermaid, updateCustomColor, updateTocTitleFont, updateTocLevelStyle, updateHeadingFont,
    renderTocFontDetails, renderHeadingDetails, handleAddCoverListItem, handleEditCoverListItem,
    handleRemoveCoverListItem, handleMoveCoverListItem,
  };

  return (
    <div className={`relative border-l h-full flex flex-col overflow-hidden text-xs transition-colors duration-200 ${
      isDark ? 'bg-[#181818] border-[#2A2A2A] text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
    }`}>
      {isThemePickerOpen && (
        <div role="dialog" aria-modal="true" aria-label="更换主题"
          className={`absolute inset-0 z-20 flex flex-col ${isDark ? 'bg-[#181818]' : 'bg-white'}`}>
          <div className={`flex items-center justify-between border-b px-4 py-3 ${sectionBorderClass}`}>
            <div>
              <h2 className={`text-sm font-semibold ${textMainClass}`}>更换主题</h2>
              <p className={`mt-0.5 text-[11px] ${textMutedClass}`}>选择交付规范，立即应用到当前文档</p>
            </div>
            <button type="button" aria-label="关闭主题选择" title="关闭主题选择" onClick={() => setIsThemePickerOpen(false)}
              className={`rounded p-1.5 ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-slate-100'}`}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {[
              { label: '自定义主题', items: themes.filter((item) => customThemeIds.includes(item.id)) },
              { label: '内置主题', items: themes.filter((item) => !customThemeIds.includes(item.id)) },
            ].filter((group) => group.items.length > 0).map((group) => (
              <section key={group.label} className="mb-5">
                <h3 className={`mb-2 text-[10px] font-bold tracking-wider ${textMutedClass}`}>{group.label}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    const selected = item.id === theme.id;
                    return <button key={item.id} type="button" aria-pressed={selected}
                      onClick={() => { onThemeChange(item); setIsThemePickerOpen(false); }}
                      className={`min-w-0 overflow-hidden rounded border text-left transition ${selected
                        ? 'border-blue-500 ring-1 ring-blue-500'
                        : isDark ? 'border-zinc-700 hover:border-zinc-500' : 'border-slate-200 hover:border-slate-400'}`}>
                      <div className="flex h-14 items-center justify-center gap-1.5 border-b border-black/10 bg-white px-3">
                        <div className="h-9 w-6 rounded-sm border border-slate-200 bg-white shadow-sm" style={{ borderTop: `5px solid ${item.style.primaryColor}` }}>
                          <div className="mx-1 mt-1 h-0.5 rounded" style={{ backgroundColor: item.style.accentColor }} />
                          <div className="mx-1 mt-1 h-0.5 rounded bg-slate-200" />
                          <div className="mx-1 mt-0.5 h-0.5 rounded bg-slate-200" />
                        </div>
                        <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: item.style.primaryColor }} />
                        <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: item.style.accentColor }} />
                      </div>
                      <div className="p-2">
                        <span className={`flex items-start justify-between gap-1 text-[11px] font-semibold leading-4 ${textMainClass}`}>
                          <span className="break-words">{item.name}</span>
                          {selected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
                        </span>
                        <span className={`mt-1 block text-[10px] leading-4 ${textMutedClass}`}>{item.description}</span>
                      </div>
                    </button>;
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
      
      {/* Tab Selector Header */}
      <div className={`flex items-center border-b p-1.5 gap-1 shrink-0 ${
        isDark ? 'border-[#2A2A2A] bg-[#0A0A0A]' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
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
            <span>页眉</span>
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
            <Type className="w-3.5 h-3.5" />
            <span>样式</span>
          </button>
          <button
            onClick={() => setActiveTab('other')}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-bold transition shrink-0 ${
              activeTab === 'other' ? 'bg-blue-600 text-white shadow-xs' : tabInactiveClass
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>其他</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {activeTab === 'cover' && <CoverTab model={tabModel} />}
        {activeTab === 'headerFooter' && <HeaderFooterTab model={tabModel} />}
        {activeTab === 'toc' && <TocTab model={tabModel} />}
        {activeTab === 'style' && <ColorsTab model={tabModel} />}
        {activeTab === 'headingList' && <HeadingListTab model={tabModel} />}
        {activeTab === 'other' && <OtherTab model={tabModel} />}

      </div>

      <ImagePicker
        isOpen={Boolean(imagePickerTarget)}
        assets={assets}
        currentReference={
          imagePickerTarget === 'cover'
            ? theme.cover.logoUrl
            : imagePickerTarget === 'header'
            ? theme.header.logoUrl
            : currentWatermark.imageUrl
        }
        isDark={isDark}
        onClose={() => setImagePickerTarget(undefined)}
        onSelect={(reference) => {
          if (imagePickerTarget === 'cover') {
            updateCover('logoUrl', reference);
          }
          if (imagePickerTarget === 'header') updateHeader('logoUrl', reference);
          if (imagePickerTarget === 'watermark') updateWatermark('imageUrl', reference);
          setImagePickerTarget(undefined);
        }}
      />
    </div>
  );
};
