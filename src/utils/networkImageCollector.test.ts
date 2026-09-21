import { describe, expect, it, vi } from 'vitest';
import { getRegisteredThemes } from '../themes/themeRegistry';
import { collectDocumentNetworkImages, findNetworkImageSources } from './networkImageCollector';

describe('network image collector', () => {
  it('finds markdown, cover and header network images once', () => {
    const theme = structuredClone(getRegisteredThemes()[0]);
    theme.cover.logoUrl = 'https://example.com/logo.png';
    theme.header.logoUrl = 'https://example.com/header.png';
    const sources = findNetworkImageSources('![正文图](https://example.com/body.jpg)\n\n[普通链接](https://example.com/page)', theme);

    expect(sources.map((source) => source.url)).toEqual([
      'https://example.com/body.jpg',
      'https://example.com/logo.png',
      'https://example.com/header.png',
    ]);
  });

  it('internalizes image references without changing normal links', async () => {
    const theme = structuredClone(getRegisteredThemes()[0]);
    theme.cover.logoUrl = 'https://example.com/logo.png';
    const loader = vi.fn().mockResolvedValue({
      data: new Uint8Array([1, 2, 3]).buffer,
      contentType: 'image/png',
    });
    const markdown = '![正文图](https://example.com/body.png)\n\n[普通链接](https://example.com/body.png)';

    const collected = await collectDocumentNetworkImages(markdown, theme, loader);

    expect(collected.assets).toHaveLength(1);
    expect(collected.markdown).toMatch(/!\[正文图\]\(@images\/img-/);
    expect(collected.markdown).toContain('[普通链接](https://example.com/body.png)');
    expect(collected.theme.cover.logoUrl).toMatch(/^@images\/img-/);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});