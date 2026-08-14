import { DocumentTheme, CoverStyle } from '../types';
import { PRESET_THEMES } from '../data/presetThemes';

export interface CoverTemplatePlugin {
  id: CoverStyle;
  name: string;
  description: string;
}

export interface ThemePlugin {
  id: string;
  theme: DocumentTheme;
  source: 'builtin' | 'custom';
}

const coverTemplates = new Map<CoverStyle, CoverTemplatePlugin>([
  ['enterprise', { id: 'enterprise', name: '🏢 企业经典', description: '经典居中与元数据表' }],
  ['modern', { id: 'modern', name: '💻 科技现代', description: '侧边深色条纹与卡片' }],
  ['spec', { id: 'spec', name: '📜 政企规范', description: '双边框与文件编号' }],
  ['minimal', { id: 'minimal', name: '🌿 极简黑白', description: '高雅留白与纤细字号' }],
  ['creative', { id: 'creative', name: '🎨 现代渐变', description: '渐变 Banner 与图示卡片' }],
  ['academic', { id: 'academic', name: '🎓 学术论文', description: '论文题目与信息填写栏' }],
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