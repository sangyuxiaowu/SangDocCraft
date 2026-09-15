export type ViewMode = 'split' | 'edit' | 'preview';
export type ThemeMode = 'system' | 'light' | 'dark';

export type CoverStyle = string;

export interface CoverListItem {
  label: string;
  value: string;
}

export interface DocumentMeta {
  title: string;
  subtitle: string;
  author: string;
  department: string;
  organization: string;
  date: string;
  logoUrl?: string;
  logo?: string;
  logoHeight?: number;
  number?: string;
  coverlist?: CoverListItem[];
  coverListColumns?: 1 | 2;
  showCover: boolean;
  coverStyle: CoverStyle;
}

export interface HeaderConfig {
  show: boolean;
  leftText: string;
  centerText: string;
  rightText: string;
  lineStyle: 'solid' | 'accent' | 'double' | 'none';
  hideOnCover: boolean;
  logoUrl?: string;
  logoHeight?: number;
  logoOpacity?: number;
  logoTopOffset?: number;
  leftTextOffset?: number;
}

export interface ImageStyleConfig {
  borderStyle: 'none' | 'solid' | 'subtle' | 'shadow' | 'card' | 'rounded';
  borderColor?: string;
  showCaption: boolean;
  autoNumber: boolean;
  numberPrefix: string;
  captionAlign: 'center' | 'left' | 'right';
}

export interface TableCaptionConfig {
  showCaption: boolean;
  autoNumber: boolean;
  numberPrefix: string;
  captionPosition: 'top' | 'bottom';
  captionAlign: 'center' | 'left' | 'right';
}

export interface FooterConfig {
  show: boolean;
  leftText: string;
  centerText: string;
  rightText: string;
  pageNumberFormat: 'page' | 'pageOfTotal' | 'hyphen' | 'simple' | 'none'; // e.g. "第 X 页", "第 X 页 / 共 Y 页", "- X -", "X / Y", "无"
  pageNumberPosition: 'left' | 'center' | 'right';
  hideOnCover: boolean;
}

export interface TocConfig {
  show: boolean;
  title: string;
  titleStyle?: 'underline' | 'accent-block' | 'badge' | 'minimal';
  maxDepth: 1 | 2 | 3 | 4;
  headingNumbering?: 'none' | 'decimal' | 'chinese';
  leaderStyle: 'dots' | 'dashes' | 'line' | 'none';
  showPageNumbers: boolean;
  pageBreakAfter: boolean;
}

export type FontChoice = 'sans' | 'serif' | 'kaiti' | 'heiti' | 'mono';

export interface HeadingFontStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  marginBefore: number;
  marginAfter: number;
}

export interface StyleConfig {
  primaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  coverBgColor: string;
  fontFamily: FontChoice;
  latinFontFamily?: string;
  bodyFontFamily: string;
  fontSize: number; // base font size in px (e.g., 14)
  lineHeight: number; // e.g. 1.6
  
  // Heading styles
  h1Style: 'underline' | 'accent-block' | 'badge' | 'minimal';
  h2Style: 'border-left' | 'number-prefix' | 'underline-subtle' | 'plain';
  h3Style: 'bullet' | 'bold' | 'plain';
  headingFonts: {
    h1: HeadingFontStyle;
    h2: HeadingFontStyle;
    h3: HeadingFontStyle;
    h4: HeadingFontStyle;
  };
  h1PageBreak?: boolean; // 一级标题另起一页 (默认 false)
  paginationMode?: 'auto' | 'manual';
  indentParagraph?: boolean; // 正文首行缩进2字符 (默认 false)
  
  // List styles
  bulletStyle: 'dot' | 'square' | 'checkmark' | 'arrow';
  numberStyle: 'decimal' | 'paren' | 'chinese';
  
  // Code block style
  codeTheme: 'dark' | 'light' | 'github';
  
  // Table style
  tableStyle: 'striped' | 'bordered' | 'minimal';
  
  // Image and Captions config
  imageConfig?: ImageStyleConfig;
  tableCaptionConfig?: TableCaptionConfig;
}

export interface DocumentTheme {
  id: string;
  name: string;
  description: string;
  meta: DocumentMeta;
  header: HeaderConfig;
  footer: FooterConfig;
  toc: TocConfig;
  style: StyleConfig;
}

export interface DocumentSettings {
  historyEnabled: boolean;
  historyIdleMinutes: number;
}

export interface DocumentHistoryEntry {
  id: string;
  createdAt: string;
  reason: 'idle' | 'manual';
  contentHash: string;
  markdown: string;
  theme: DocumentTheme;
}

export type DocumentAssetScope = 'document' | 'library';

export interface DocumentAssetMetadata {
  id: string;
  fileName: string;
  description: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
  scope: DocumentAssetScope;
}

export interface DocumentAsset extends DocumentAssetMetadata {
  data: Uint8Array;
}

export interface SangDocument {
  id: string;
  title: string;
  createdAt: string;
  modifiedAt: string;
  markdown: string;
  theme: DocumentTheme;
  settings: DocumentSettings;
  history: DocumentHistoryEntry[];
  assets: DocumentAsset[];
}

export interface TocItem {
  id: string;
  text: string;
  level: number; // 1, 2, 3
  pageNumber?: number;
}
