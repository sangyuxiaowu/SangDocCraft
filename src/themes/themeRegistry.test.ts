import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';

async function loadRegistry() {
  vi.resetModules();
  return import('./themeRegistry');
}

describe('themeRegistry', () => {
  beforeEach(() => vi.resetModules());

  it('registers every preset theme and its cover template', async () => {
    const registry = await loadRegistry();
    expect(registry.getRegisteredThemes().map((theme) => theme.id)).toEqual(PRESET_THEMES.map((theme) => theme.id));
    expect(new Set(PRESET_THEMES.map((theme) => theme.id)).size).toBe(PRESET_THEMES.length);
    for (const theme of PRESET_THEMES) {
      expect(registry.hasCoverTemplate(theme.meta.coverStyle)).toBe(true);
    }
  });

  it('falls back to the enterprise cover for unknown IDs', async () => {
    const registry = await loadRegistry();
    expect(registry.getCoverTemplate('missing').id).toBe('enterprise');
  });

  it('supports custom covers and themes and rejects missing covers', async () => {
    const registry = await loadRegistry();
    const customCover = { ...registry.getCoverTemplate('enterprise'), id: 'custom-cover', name: 'Custom' };
    registry.registerCoverTemplate(customCover);

    const customTheme = {
      ...PRESET_THEMES[0],
      id: 'custom-theme',
      meta: { ...PRESET_THEMES[0].meta, coverStyle: 'custom-cover' },
    };
    registry.registerThemePlugin({ id: customTheme.id, theme: customTheme, source: 'custom' });
    expect(registry.getRegisteredThemes().at(-1)?.id).toBe('custom-theme');

    expect(() => registry.registerThemePlugin({
      id: 'invalid-theme',
      theme: { ...customTheme, id: 'invalid-theme', meta: { ...customTheme.meta, coverStyle: 'missing' } },
      source: 'custom',
    })).toThrow('未注册的封面模板');
  });
});