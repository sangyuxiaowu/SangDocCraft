import type { DocumentTheme } from '../types';

export const CURRENT_THEME_CACHE_KEY = 'sangdoccraft_current_theme_v2';
const CURRENT_THEME_CACHE_SCHEMA_VERSION = 1;

interface CurrentThemeCache {
  schemaVersion: typeof CURRENT_THEME_CACHE_SCHEMA_VERSION;
  themeId: string;
}

export function loadCurrentTheme(themes: DocumentTheme[]): DocumentTheme {
  const fallback = themes[0];
  try {
    const stored = localStorage.getItem(CURRENT_THEME_CACHE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<CurrentThemeCache>;
    if (parsed.schemaVersion !== CURRENT_THEME_CACHE_SCHEMA_VERSION || typeof parsed.themeId !== 'string') {
      return fallback;
    }
    return themes.find((theme) => theme.id === parsed.themeId) || fallback;
  } catch {
    return fallback;
  }
}

export function saveCurrentTheme(themeId: string): void {
  localStorage.setItem(CURRENT_THEME_CACHE_KEY, JSON.stringify({
    schemaVersion: CURRENT_THEME_CACHE_SCHEMA_VERSION,
    themeId,
  } satisfies CurrentThemeCache));
}