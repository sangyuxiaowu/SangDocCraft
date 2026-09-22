import { describe, expect, it, vi } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';
import { CURRENT_THEME_FORMAT_VERSION, migrateThemeData } from './documentMigrations';

describe('migrateThemeData', () => {
  it('recursively fills every missing theme field while preserving supplied values', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const theme = migrateThemeData(CURRENT_THEME_FORMAT_VERSION, {
      id: 'partial-theme',
      name: 'Partial Theme',
      style: { primaryColor: '#123456' },
    });

    expect(theme.id).toBe('partial-theme');
    expect(theme.style.primaryColor).toBe('#123456');
    expect(theme.style.headingFonts).toEqual(PRESET_THEMES[0].style.headingFonts);
    expect(theme.cover).toEqual(PRESET_THEMES[0].cover);
    expect(theme.header).toEqual(PRESET_THEMES[0].header);
    expect(theme.meta).toEqual(PRESET_THEMES[0].meta);
    expect(info).toHaveBeenCalledWith('[SangDocCraft] 主题处理完成', {
      fromVersion: CURRENT_THEME_FORMAT_VERSION,
      toVersion: CURRENT_THEME_FORMAT_VERSION,
      theme,
    });

    info.mockRestore();
  });

  it('accepts a v1 theme even when its legacy meta object is missing', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const theme = migrateThemeData(1, {});

    expect(theme).toEqual(PRESET_THEMES[0]);
    info.mockRestore();
  });
});