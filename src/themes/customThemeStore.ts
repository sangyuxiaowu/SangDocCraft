import type { DocumentTheme } from '../types';
import { hasCoverTemplate } from './themeRegistry';

export const CUSTOM_THEMES_STORAGE_KEY = 'sangdoccraft_custom_themes';

export function validateTheme(value: unknown): DocumentTheme {
  if (!value || typeof value !== 'object') {
    throw new Error('主题必须是有效的 JSON 对象');
  }

  const theme = value as Partial<DocumentTheme>;
  if (!theme.id?.trim() || !theme.name?.trim()) {
    throw new Error('主题必须包含非空的 id 和 name');
  }
  if (!theme.meta || !theme.header || !theme.footer || !theme.toc || !theme.style) {
    throw new Error('主题缺少 meta、header、footer、toc 或 style 配置');
  }
  if (!hasCoverTemplate(theme.meta.coverStyle)) {
    throw new Error(`未注册的封面模板：${theme.meta.coverStyle || '未指定'}`);
  }

  return theme as DocumentTheme;
}

export function createCustomTheme(source: DocumentTheme, existingIds: string[]): DocumentTheme {
  const idBase = `custom-${source.id.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}`;
  let id = idBase;
  let suffix = 2;
  while (existingIds.includes(id)) {
    id = `${idBase}-${suffix++}`;
  }

  return {
    ...structuredClone(source),
    id,
    name: `${source.name.replace(/^\S+\s*/, '')} 自定义`,
  };
}

export function loadCustomThemes(): DocumentTheme[] {
  try {
    const stored = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value) => {
      try {
        return [validateTheme(value)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: DocumentTheme[]): void {
  localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(themes));
}