import type { ReactNode } from 'react';
import type { ImageRun, Paragraph, Table } from 'docx';
import type { CoverListItem, CoverStyle, DocumentMeta, DocumentTheme, StyleConfig } from '../types';

export interface CoverRenderContext {
  meta: DocumentMeta;
  style: StyleConfig;
  coverListItems: CoverListItem[];
}

export interface CoverDocxRenderContext extends CoverRenderContext {
  primaryHex: string;
  accentHex: string;
  textHex: string;
  fontName: string;
  docxFont: { ascii: string; hAnsi: string; eastAsia: string };
  createImageRun: (source: string, altText: string, width?: number, height?: number) => Promise<ImageRun | null>;
}

export interface CoverTemplatePlugin {
  id: CoverStyle;
  name: string;
  description: string;
  defaultLogoHeight?: number;
  renderThumbnail: (context: CoverRenderContext) => ReactNode;
  renderPreview: (context: CoverRenderContext) => ReactNode;
  renderHtml: (context: CoverRenderContext) => string;
  renderDocx: (context: CoverDocxRenderContext) => Promise<(Paragraph | Table)[]>;
}

export interface ThemePlugin {
  id: string;
  theme: DocumentTheme;
  source: 'builtin' | 'custom';
}
