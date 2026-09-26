import { DocumentTheme, CoverStyle } from '../types';
import { PRESET_THEMES } from '../data/presetThemes';
import { academicCoverPlugin } from './covers/academic';
import type { CoverTemplatePlugin, ThemePlugin } from './contracts';
import { enterpriseCoverPlugin } from './covers/enterprise';
import { modernCoverPlugin } from './covers/modern';
import { specCoverPlugin } from './covers/spec';
import { minimalCoverPlugin } from './covers/minimal';
import { creativeCoverPlugin } from './covers/creative';
import { signatureCoverPlugin } from './covers/signature';
import { briefingCoverPlugin } from './covers/briefing';
import { researchCoverPlugin } from './covers/research';

export type { CoverDocxRenderContext, CoverRenderContext, CoverTemplatePlugin, ThemePlugin } from './contracts';

const coverTemplates = new Map<CoverStyle, CoverTemplatePlugin>([
  ...[enterpriseCoverPlugin, modernCoverPlugin, specCoverPlugin, minimalCoverPlugin, creativeCoverPlugin].map((plugin) => [plugin.id, plugin] as const),
  ['academic', academicCoverPlugin],
  ...[signatureCoverPlugin, briefingCoverPlugin, researchCoverPlugin].map((plugin) => [plugin.id, plugin] as const),
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
  if (!hasCoverTemplate(plugin.theme.cover.coverStyle)) {
    throw new Error(`未注册的封面模板：${plugin.theme.cover.coverStyle}`);
  }
  themePlugins.set(plugin.id, plugin);
}