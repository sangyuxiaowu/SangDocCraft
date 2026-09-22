// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';
import { createCustomTheme, CUSTOM_THEMES_STORAGE_KEY, loadCustomThemes, saveCustomThemes, validateTheme } from './customThemeStore';

describe('customThemeStore', () => {
  beforeEach(() => localStorage.clear());

  it('creates a unique custom copy without mutating its source', () => {
    const source = PRESET_THEMES[0];
    const custom = createCustomTheme(source, [`custom-${source.id}`]);

    expect(custom.id).toBe(`custom-${source.id}-2`);
    expect(custom.name).toContain('自定义');
    expect(custom).not.toBe(source);
    expect(custom.style).not.toBe(source.style);
  });

  it('persists valid themes and fills missing fields in stored entries', () => {
    const custom = createCustomTheme(PRESET_THEMES[0], []);
    saveCustomThemes([custom]);
    expect(loadCustomThemes()).toEqual([custom]);

    localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify([custom, { id: 'broken' }]));
    const loaded = loadCustomThemes();
    expect(loaded[0]).toEqual(custom);
    expect(loaded[1]).toEqual(expect.objectContaining({
      id: 'broken',
      cover: PRESET_THEMES[0].cover,
      style: PRESET_THEMES[0].style,
    }));
  });

  it('rejects themes with unknown cover templates', () => {
    expect(() => validateTheme({
      ...PRESET_THEMES[0],
      cover: { ...PRESET_THEMES[0].cover, coverStyle: 'missing-cover' },
    })).toThrow('未注册的封面模板');
  });
});