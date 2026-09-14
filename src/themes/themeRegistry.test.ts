import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';
import { renderToStaticMarkup } from 'react-dom/server';

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

  it.each([20, 80, 120])('applies a %i px logo height to every cover preview and export', async (logoHeight) => {
    const registry = await loadRegistry();
    for (const plugin of registry.getCoverTemplates()) {
      const context = {
        meta: { ...PRESET_THEMES[0].meta, logo: 'logo.png', logoHeight },
        style: PRESET_THEMES[0].style,
        coverListItems: [],
      };
      expect(renderToStaticMarkup(plugin.renderPreview(context))).toContain(`height:${logoHeight}px`);
      expect(plugin.renderHtml(context)).toContain(`height:${logoHeight}px;max-height:none;width:auto;`);
      const createImageRun = vi.fn().mockResolvedValue(null);
      await plugin.renderDocx({ ...context, primaryHex: '000000', accentHex: '000000', textHex: '000000', fontName: 'Arial', docxFont: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'SimSun' }, createImageRun });
      expect(createImageRun).toHaveBeenCalledWith('logo.png', '文档标志', undefined, logoHeight);
    }
  });

  it('retains the original preset logo sizes when no height is configured', async () => {
    const registry = await loadRegistry();
    const defaults = { enterprise: [40, 36], modern: [32, 28], spec: [32, 28], minimal: [24, 24], creative: [28, 24], academic: [64, 64] };
    for (const [id, [previewHeight, htmlHeight]] of Object.entries(defaults)) {
      const plugin = registry.getCoverTemplate(id);
      const context = { meta: { ...PRESET_THEMES[0].meta, logo: 'logo.png' }, style: PRESET_THEMES[0].style, coverListItems: [] };
      expect(plugin.defaultLogoHeight).toBe(previewHeight);
      expect(renderToStaticMarkup(plugin.renderPreview(context))).not.toMatch(/style="height:/);
      if (id === 'academic') {
        expect(plugin.renderHtml(context)).toContain('class="academic-cover-logo" alt="Logo"');
      } else {
        expect(plugin.renderHtml(context)).toContain(`max-height:${htmlHeight}px;`);
      }
      const createImageRun = vi.fn().mockResolvedValue(null);
      await plugin.renderDocx({ ...context, primaryHex: '000000', accentHex: '000000', textHex: '000000', fontName: 'Arial', docxFont: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'SimSun' }, createImageRun });
      expect(createImageRun.mock.calls[0]).toEqual(id === 'academic' ? ['logo.png', '文档标志', 180, 100] : ['logo.png', '文档标志']);
    }
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