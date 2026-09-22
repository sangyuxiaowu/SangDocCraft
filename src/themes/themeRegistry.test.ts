import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoverMetadata, coverMetadataHtml, coverMetadataDocx } from './coverMetadata';
import { Document, Packer } from 'docx';

async function loadRegistry() {
  vi.resetModules();
  return import('./themeRegistry');
}

describe('themeRegistry', () => {
  beforeEach(() => vi.resetModules());

  it.each([1, 2] as const)('renders metadata in %i columns without losing odd or empty fields', async (coverListColumns) => {
    const context = {
      meta: DEFAULT_DOCUMENT_META,
      cover: { ...PRESET_THEMES[0].cover, coverListColumns },
      style: PRESET_THEMES[0].style,
      coverListItems: [{ label: 'Author', value: 'Alice' }, { label: 'Date:', value: '' }, { label: 'Reviewer', value: 'Bob' }],
    };
    for (const html of [renderToStaticMarkup(CoverMetadata({ context })), coverMetadataHtml(context)]) {
      expect(html).toContain(`data-cover-columns="${coverListColumns}"`);
      expect(html.indexOf('Alice')).toBeLessThan(html.indexOf('Date:'));
      expect(html.indexOf('Date:')).toBeLessThan(html.indexOf('Bob'));
      expect(html).not.toContain('Date:：');
    }
    const tables = coverMetadataDocx({ ...context, primaryHex: '000000', accentHex: '000000', textHex: '000000', fontName: 'Arial', docxFont: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'SimSun' }, createImageRun: vi.fn() });
    const document = new Document({ sections: [{ children: tables }] });
    const xml = JSON.stringify(tables[0].prepForXml({ file: document, viewWrapper: document.Document, stack: [] }));
    expect(xml.match(/"w:tr":/g)).toHaveLength(Math.ceil(3 / coverListColumns));
    expect(xml.match(/"w:tc":/g)).toHaveLength(Math.ceil(3 / coverListColumns) * (coverListColumns === 2 ? 5 : 2));
    expect(xml).toContain('Alice');
    expect(xml).toContain('Bob');
    expect(xml).toContain(`"w:w":${coverListColumns === 2 ? 7680 : 4400}`);
    expect(xml).toContain('"w:val":"center"');
    expect((await Packer.toBuffer(document)).length).toBeGreaterThan(0);
  });

  it('registers every preset theme and its cover template', async () => {
    const registry = await loadRegistry();
    expect(registry.getRegisteredThemes().map((theme) => theme.id)).toEqual(PRESET_THEMES.map((theme) => theme.id));
    expect(registry.getRegisteredThemes().map((theme) => theme.cover.coverStyle)).toEqual(expect.arrayContaining(['signature', 'briefing']));
    expect(new Set(PRESET_THEMES.map((theme) => theme.id)).size).toBe(PRESET_THEMES.length);
    for (const theme of PRESET_THEMES) {
      expect(registry.hasCoverTemplate(theme.cover.coverStyle)).toBe(true);
    }
  });

  it('uses minimal toc and heading styles for the signature theme', () => {
    const theme = PRESET_THEMES.find((preset) => preset.id === 'enterprise-signature');
    expect(theme?.toc.titleStyle).toBe('minimal');
    expect(theme?.style.h1Style).toBe('minimal');
    expect(theme?.style.h2Style).toBe('plain');
    expect(theme?.style.h3Style).toBe('plain');
  });

  it('falls back to the enterprise cover for unknown IDs', async () => {
    const registry = await loadRegistry();
    expect(registry.getCoverTemplate('missing').id).toBe('enterprise');
  });

  it.each(['enterprise', 'academic', 'signature', 'briefing'])('supports metadata layout defaults and overrides in %s', async (id) => {
    const registry = await loadRegistry();
    expect(registry.getCoverTemplates()).toHaveLength(8);
    const plugin = registry.getCoverTemplate(id);
    const defaultColumns = ['signature', 'briefing'].includes(id) ? 2 : 1;
    expect(plugin.defaultCoverListColumns).toBe(defaultColumns);
    for (const columns of [undefined, 1, 2] as const) {
      const context = { meta: DEFAULT_DOCUMENT_META, cover: { ...PRESET_THEMES[0].cover, coverStyle: id, coverListColumns: columns }, style: PRESET_THEMES[0].style, coverListItems: [{ label: 'Author', value: 'Alice' }, { label: 'Date', value: '' }, { label: 'Reviewer', value: 'Bob' }] };
      expect(renderToStaticMarkup(plugin.renderPreview(context))).toContain(`data-cover-columns="${columns ?? defaultColumns}"`);
      expect(plugin.renderHtml(context)).toContain(`data-cover-columns="${columns ?? defaultColumns}"`);
      for (const html of [renderToStaticMarkup(plugin.renderPreview(context)), plugin.renderHtml(context)]) {
        expect(html).toContain(`max-width:${(columns ?? defaultColumns) === 2 ? '80%' : '44%'}`);
        expect(html).toContain('margin:0 auto');
      }
      const children = await plugin.renderDocx({ ...context, primaryHex: '000000', accentHex: '000000', textHex: '000000', fontName: 'Arial', docxFont: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'SimSun' }, createImageRun: vi.fn().mockResolvedValue(null) });
      const document = new Document({ sections: [{ children }] });
      const xml = JSON.stringify(document.Document.View.prepForXml({ file: document, viewWrapper: document.Document, stack: [] }));
      expect(xml.match(/"w:tr":/g)).toHaveLength(Math.ceil(3 / (columns ?? defaultColumns)));
    }
  });

  it.each(['signature', 'briefing'])('orders and hides optional cover fields in %s', async (id) => {
    const registry = await loadRegistry();
    const plugin = registry.getCoverTemplate(id);
    const context = { meta: { ...DEFAULT_DOCUMENT_META, number: 'DOC-001', title: 'Main title', subtitle: 'Subtitle', organization: 'Company name', date: '2026-09-14' }, cover: { ...PRESET_THEMES[0].cover, logoUrl: 'brand.png' }, style: PRESET_THEMES[0].style, coverListItems: [{ label: 'Author', value: 'Alice' }] };
    for (const html of [renderToStaticMarkup(plugin.renderPreview(context)), plugin.renderHtml(context)]) {
      const positions = ['<img', 'DOC-001', 'Main title', 'Subtitle', 'Alice', 'Company name', '2026-09-14'].map((text) => html.indexOf(text));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((left, right) => left - right));
    }
    const emptyContext = { ...context, meta: { ...context.meta, number: '', subtitle: '', organization: '', date: '' }, cover: { ...context.cover, logoUrl: '' }, coverListItems: [] };
    for (const html of [renderToStaticMarkup(plugin.renderPreview(emptyContext)), plugin.renderHtml(emptyContext)]) {
      expect(html).toContain('Main title');
      expect(html).not.toMatch(/<img|文档编号|Subtitle|Company name|2026-09-14/);
    }
  });

  it.each([20, 80, 120])('applies a %i px logo height to every cover preview and export', async (logoHeight) => {
    const registry = await loadRegistry();
    for (const plugin of registry.getCoverTemplates()) {
      const context = {
        meta: DEFAULT_DOCUMENT_META,
        cover: { ...PRESET_THEMES[0].cover, logoUrl: 'logo.png', logoHeight },
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
      const context = { meta: DEFAULT_DOCUMENT_META, cover: { ...PRESET_THEMES[0].cover, logoUrl: 'logo.png' }, style: PRESET_THEMES[0].style, coverListItems: [] };
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

  // 卡片式封面（creative）的 label 首 emoji 必须独立成列：
  it('splits a leading emoji out of creative cover cards in preview and HTML', async () => {
    const registry = await loadRegistry();
    const plugin = registry.getCoverTemplate('creative');
    const context = {
      meta: { ...DEFAULT_DOCUMENT_META, department: 'FRONTIER EXPLORATION GROUP' },
      cover: { ...PRESET_THEMES[0].cover, coverStyle: 'creative' as const },
      style: PRESET_THEMES[0].style,
      coverListItems: [{ label: '🎨 Author', value: 'Alice' }, { label: 'Reviewer', value: 'Bob' }],
    };

    const preview = renderToStaticMarkup(plugin.renderPreview(context));
    expect(preview).toMatch(/shrink-0[^>]*>🎨</);
    expect(preview).toContain('>Author</div>');
    expect(preview).not.toContain('🎨 Author');
    expect(preview).toContain('FRONTIER EXPLORATION GROUP');

    const html = plugin.renderHtml(context);
    expect(html).toContain('<span class="emoji">🎨</span>');
    expect(html).toContain('<div class="label">Author</div>');
    expect(html).not.toContain('🎨 Author');
    expect(html).toContain('text-align:center;font-size:10px;color:#94a3b8;letter-spacing:2px;font-weight:bold;">FRONTIER EXPLORATION GROUP</div>');

    // 没有 emoji 的 label 不应产生多余的空 emoji 列
    const plainHtml = plugin.renderHtml({ ...context, coverListItems: [{ label: 'Reviewer', value: 'Bob' }] });
    expect(plainHtml).not.toContain('class="emoji"');
  });

  it('supports custom covers and themes and rejects missing covers', async () => {
    const registry = await loadRegistry();
    const customCover = { ...registry.getCoverTemplate('enterprise'), id: 'custom-cover', name: 'Custom' };
    registry.registerCoverTemplate(customCover);

    const customTheme = {
      ...PRESET_THEMES[0],
      id: 'custom-theme',
      cover: { ...PRESET_THEMES[0].cover, coverStyle: 'custom-cover' },
    };
    registry.registerThemePlugin({ id: customTheme.id, theme: customTheme, source: 'custom' });
    expect(registry.getRegisteredThemes().at(-1)?.id).toBe('custom-theme');

    expect(() => registry.registerThemePlugin({
      id: 'invalid-theme',
      theme: { ...customTheme, id: 'invalid-theme', cover: { ...customTheme.cover, coverStyle: 'missing' } },
      source: 'custom',
    })).toThrow('未注册的封面模板');
  });
});