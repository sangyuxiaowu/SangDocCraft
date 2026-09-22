import type { DocumentTheme } from '../types';
import { CURRENT_THEME_FORMAT_VERSION, inferThemeFormatVersion, migrateThemeData } from '../utils/documentMigrations';
import { hasCoverTemplate } from './themeRegistry';

export const CUSTOM_THEMES_STORAGE_KEY = 'sangdoccraft_custom_themes';

interface CustomThemeStorage {
  schemaVersion: number;
  themes: unknown[];
}

export function validateTheme(value: unknown, fromVersion = inferThemeFormatVersion(value)): DocumentTheme {
  const theme = migrateThemeData(fromVersion, value);
  if (!hasCoverTemplate(theme.cover.coverStyle)) {
    throw new Error(`未注册的封面模板：${theme.cover.coverStyle || '未指定'}`);
  }

  return theme;
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
    const storage: CustomThemeStorage = Array.isArray(parsed)
      ? { schemaVersion: 0, themes: parsed }
      : parsed;
    if (!storage || !Array.isArray(storage.themes)) return [];
    if (storage.schemaVersion > CURRENT_THEME_FORMAT_VERSION) return [];
    const storedThemeVersion = storage.schemaVersion === 0 ? undefined : storage.schemaVersion;
    return storage.themes.flatMap((value) => {
      try {
        return [validateTheme(value, storedThemeVersion)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: DocumentTheme[]): void {
  localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify({
    schemaVersion: CURRENT_THEME_FORMAT_VERSION,
    themes,
  } satisfies CustomThemeStorage));
}