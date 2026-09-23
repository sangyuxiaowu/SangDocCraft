import { describe, expect, it, vi } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';
import { CURRENT_THEME_FORMAT_VERSION, migrateDocumentData, migrateThemeData } from './documentMigrations';

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
    expect(theme.mermaid?.theme).toBe('neutral');
    expect(theme).not.toHaveProperty('meta');
    expect(info).toHaveBeenCalledWith('[SangDocCraft] 主题处理完成', {
      fromVersion: CURRENT_THEME_FORMAT_VERSION,
      toVersion: CURRENT_THEME_FORMAT_VERSION,
      theme,
    });

    info.mockRestore();
  });

  it('extracts document meta from an embedded v2 beta theme', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const migrated = migrateDocumentData(2, {
      theme: { ...PRESET_THEMES[0], meta: { title: '旧版标题', author: '旧作者' } },
      history: [],
    });

    expect(migrated.meta).toMatchObject({ title: '旧版标题', author: '旧作者' });
    expect(migrated.theme).not.toHaveProperty('meta');
    info.mockRestore();
  });

  it('accepts a v1 theme even when its legacy meta object is missing', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const theme = migrateThemeData(1, {});

    expect(theme).toEqual(PRESET_THEMES[0]);
    info.mockRestore();
  });

  it('normalizes legacy auto mermaid theme and assigns default neutral for themes without mermaid', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const legacyAutoTheme = migrateThemeData(CURRENT_THEME_FORMAT_VERSION, {
      id: 'legacy-auto',
      mermaid: { theme: 'auto' },
    });
    expect(legacyAutoTheme.mermaid?.theme).toBe('neutral');

    const customTheme = migrateThemeData(CURRENT_THEME_FORMAT_VERSION, {
      id: 'custom-mermaid',
      mermaid: { theme: 'custom', customColors: { primaryColor: '#ff0000' } },
    });
    expect(customTheme.mermaid?.theme).toBe('custom');
    expect(customTheme.mermaid?.customColors?.primaryColor).toBe('#ff0000');
    info.mockRestore();
  });
});