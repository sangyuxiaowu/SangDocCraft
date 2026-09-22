// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';
import { CURRENT_THEME_CACHE_KEY, loadCurrentTheme, saveCurrentTheme } from './currentThemeCache';

describe('currentThemeCache', () => {
  beforeEach(() => localStorage.clear());

  it('ignores legacy full-theme caches', () => {
    localStorage.setItem('sangdoccraft_current_theme', JSON.stringify({ id: 'broken' }));

    expect(loadCurrentTheme(PRESET_THEMES)).toBe(PRESET_THEMES[0]);
  });

  it('stores only a versioned theme id and resolves it from trusted themes', () => {
    saveCurrentTheme(PRESET_THEMES[1].id);

    expect(loadCurrentTheme(PRESET_THEMES)).toBe(PRESET_THEMES[1]);
    expect(JSON.parse(localStorage.getItem(CURRENT_THEME_CACHE_KEY)!)).toEqual({
      schemaVersion: 1,
      themeId: PRESET_THEMES[1].id,
    });
  });

  it('falls back when the cache is malformed or references a missing theme', () => {
    localStorage.setItem(CURRENT_THEME_CACHE_KEY, JSON.stringify({ schemaVersion: 1, themeId: 'missing' }));
    expect(loadCurrentTheme(PRESET_THEMES)).toBe(PRESET_THEMES[0]);

    localStorage.setItem(CURRENT_THEME_CACHE_KEY, '{bad json');
    expect(loadCurrentTheme(PRESET_THEMES)).toBe(PRESET_THEMES[0]);
  });
});