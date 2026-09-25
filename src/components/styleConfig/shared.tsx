import React from 'react';
import { Plus } from 'lucide-react';
import { DocumentMeta, DocumentTheme, CoverConfig, HeaderConfig, FooterConfig, TocConfig, StyleConfig, ImageStyleConfig, TableCaptionConfig, CoverListItem, HeadingFontStyle, TocLevelStyle, TocTitleFont, WatermarkConfig, MermaidConfig, MermaidCustomColors } from '../../types';

interface ColorPickerInputProps {
  value: string;
  onChange: (val: string) => void;
  inputClass: string;
}

export const ColorPickerInput: React.FC<ColorPickerInputProps> = ({
  value,
  onChange,
  inputClass,
}) => {
  const safeHex = typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={safeHex}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded border border-gray-600 bg-transparent cursor-pointer shrink-0"
        title="点击调出色盘"
      />
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full min-w-0 rounded px-2 py-1 text-xs font-mono uppercase ${inputClass}`}
      />
    </div>
  );
};

const FIELD_OPTIONS = [
  ['title', '标题'], ['subtitle', '副标题'], ['author', '作者'],
  ['department', '部门'], ['organization', '组织'], ['date', '日期'],
  ['number', '编号'], ['version', '版本'],
];

export function DynamicFieldInput({ value, onChange, inputClass, className, section = false, label }: {
  value: string;
  onChange: (value: string) => void;
  inputClass: string;
  className?: string;
  section?: boolean;
  label: string;
}) {
  const insert = (field: string) => {
    onChange(`@${field}`);
  };

  return <div className={`relative min-w-0 ${className ?? ''}`}>
    <input type="text" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}
      className={`w-full min-w-0 rounded pl-2 pr-9 py-1.5 ${inputClass}`} />
    <Plus aria-hidden="true" size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
    <select aria-label={`${label}插入变量`} title="插入动态字段" defaultValue="" onChange={(event) => {
      insert(event.target.value);
      event.target.value = '';
    }} className="absolute right-0 top-0 h-full w-8 cursor-pointer opacity-0">
      <option value="" disabled>＋</option>
      {FIELD_OPTIONS.map(([field, name]) => <option key={field} value={field}>@{field} {name}</option>)}
      {section && <>
        <option value="h1">@h1 一级章节</option>
        <option value="h2">@h2 二级章节</option>
      </>}
    </select>
  </div>;
}


export interface PanelTabModel {
  theme: DocumentTheme;
  meta: DocumentMeta;
  onChange: (theme: DocumentTheme) => void;
  isDark: boolean;
  sectionBorderClass: string;
  labelClass: string;
  textMainClass: string;
  textMutedClass: string;
  textSubClass: string;
  cardBgClass: string;
  subCardBgClass: string;
  inputClass: string;
  buttonDashedClass: string;
  tabInactiveClass: string;
  currentCoverList: CoverListItem[];
  imageConfig: ImageStyleConfig;
  tableCaptionConfig: TableCaptionConfig;
  currentWatermark: WatermarkConfig;
  mermaidConfig: MermaidConfig;
  openThemePicker: () => void;
  openImagePicker: (target: 'cover' | 'header' | 'watermark') => void;
  updateMeta: (field: keyof DocumentMeta, value: string | undefined) => void;
  updateCover: <T extends keyof CoverConfig>(field: T, value: CoverConfig[T]) => void;
  updateHeader: <T extends keyof HeaderConfig>(field: T, value: HeaderConfig[T]) => void;
  updateFooter: <T extends keyof FooterConfig>(field: T, value: FooterConfig[T]) => void;
  updateToc: <T extends keyof TocConfig>(field: T, value: TocConfig[T]) => void;
  updateStyle: <T extends keyof StyleConfig>(field: T, value: StyleConfig[T]) => void;
  updateWatermark: <T extends keyof WatermarkConfig>(field: T, value: WatermarkConfig[T]) => void;
  updateMermaid: (updates: Partial<MermaidConfig>) => void;
  updateCustomColor: (key: keyof MermaidCustomColors, value: string) => void;
  updateTocTitleFont: (field: keyof TocTitleFont, value: string | number | boolean) => void;
  updateTocLevelStyle: (index: number, field: keyof TocLevelStyle, value: string | number | boolean) => void;
  updateHeadingFont: (level: keyof StyleConfig['headingFonts'], field: keyof HeadingFontStyle, value: string | number | boolean) => void;
  renderTocFontDetails: (label: string, config: TocTitleFont, onUpdate: (field: keyof TocTitleFont, value: string | number | boolean) => void, indent?: {value: number; onChange: (value: number) => void}) => React.ReactNode;
  renderHeadingDetails: (level: keyof StyleConfig['headingFonts'], label: string) => React.ReactNode;
  handleAddCoverListItem: () => void;
  handleEditCoverListItem: (index: number, key: 'label' | 'value', value: string) => void;
  handleRemoveCoverListItem: (index: number) => void;
  handleMoveCoverListItem: (index: number, direction: -1 | 1) => void;
}
