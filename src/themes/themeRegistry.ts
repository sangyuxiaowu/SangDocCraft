import type { ReactNode } from 'react';
import type { ImageRun, Paragraph, Table, TextRun } from 'docx';
import { CoverListItem, DocumentMeta, DocumentTheme, CoverStyle, StyleConfig } from '../types';
import { PRESET_THEMES } from '../data/presetThemes';
import { academicCoverPlugin } from './academicCoverPlugin';
import { builtinCoverPlugins } from './builtinCoverPlugins';

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
  renderPreview: (context: CoverRenderContext) => ReactNode;
  renderHtml: (context: CoverRenderContext) => string;
  renderDocx: (context: CoverDocxRenderContext) => Promise<(Paragraph | Table)[]>;
}

export interface ThemePlugin {
  id: string;
  theme: DocumentTheme;
  source: 'builtin' | 'custom';
}

const coverTemplates = new Map<CoverStyle, CoverTemplatePlugin>([
  ...builtinCoverPlugins.map((plugin) => [plugin.id, plugin] as const),
  ['academic', academicCoverPlugin],
]);

const themePlugins = new Map<string, ThemePlugin>(
  PRESET_THEMES.map((theme) => [theme.id, { id: theme.id, theme, source: 'builtin' }]),
);

export function getCoverTemplates(): CoverTemplatePlugin[] {
  return [...coverTemplates.values()];
}

export function hasCoverTemplate(id: string | undefined): id is CoverStyle {
  return Boolean(id && coverTemplates.has(id));
}

export function getCoverTemplate(id: string | undefined): CoverTemplatePlugin {
  return coverTemplates.get(id || '') || coverTemplates.get('enterprise')!;
}

export function registerCoverTemplate(plugin: CoverTemplatePlugin): void {
  coverTemplates.set(plugin.id, plugin);
}

export function getThemePlugins(): ThemePlugin[] {
  return [...themePlugins.values()];
}

export function getRegisteredThemes(): DocumentTheme[] {
  return getThemePlugins().map((plugin) => plugin.theme);
}

export function registerThemePlugin(plugin: ThemePlugin): void {
  if (!hasCoverTemplate(plugin.theme.meta.coverStyle)) {
    throw new Error(`未注册的封面模板：${plugin.theme.meta.coverStyle}`);
  }
  themePlugins.set(plugin.id, plugin);
}