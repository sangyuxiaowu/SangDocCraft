import { describe, expect, it } from 'vitest';
import { getRegisteredThemes } from '../themes/themeRegistry';
import type { DocumentAsset, DocumentAssetScope } from '../types';
import { collectAssetDisplaySizes, planDocumentImageOptimization } from './imageBatchOptimizer';

function createAsset(
  id: string,
  mediaType: string,
  byteLength: number,
  scope: DocumentAssetScope = 'document',
): DocumentAsset {
  return {
    id,
    fileName: `${id}.png`,
    description: '',
    mediaType,
    byteLength,
    sha256: 'a'.repeat(64),
    scope,
    data: new Uint8Array(byteLength),
  };
}

function createTheme(logoReferences: { cover?: string; header?: string } = {}) {
  const theme = structuredClone(getRegisteredThemes()[0]);
  theme.cover.logoUrl = logoReferences.cover ?? '@images/img-cover0001';
  theme.cover.logoHeight = 40;
  theme.header.logoUrl = logoReferences.header ?? '@library/img-libused01';
  theme.header.logoHeight = 32;
  return theme;
}

describe('collectAssetDisplaySizes', () => {
  it('collects sizes from markdown, inline html images and theme logos', () => {
    const markdown = [
      '![架构图](@images/img-markdown01){w=520}',
      '<img src="@images/img-markdown01" />{w=640 h=360}',
      '<img src="@images/img-html0001" alt="截图" />{h=200}',
      '![网络图](https://example.com/a.png){w=100}',
    ].join('\n\n');

    const sizes = collectAssetDisplaySizes(markdown, createTheme());

    // 同一图片多处引用时取各维度最大值
    expect(sizes.get('img-markdown01')).toEqual({ width: 640, height: 360 });
    expect(sizes.get('img-html0001')).toEqual({ height: 200 });
    expect(sizes.get('img-cover0001')).toEqual({ height: 40 });
    expect(sizes.get('img-libused01')).toEqual({ height: 32 });
    expect(sizes.size).toBe(4);
  });

  it('ignores images without a valid size suffix and network images', () => {
    const sizes = collectAssetDisplaySizes(
      '![图](@images/img-plain0001)\n\n![网图](https://example.com/a.png){w=100}',
      createTheme({ cover: 'https://example.com/logo.png', header: '' }),
    );

    expect(sizes.size).toBe(0);
  });
});

describe('planDocumentImageOptimization', () => {
  const assets = [
    createAsset('img-used0001', 'image/png', 4000),
    createAsset('img-unused001', 'image/jpeg', 2000),
    createAsset('img-webp00001', 'image/webp', 800),
    createAsset('img-vector001', 'image/svg+xml', 500),
    createAsset('img-libused01', 'image/png', 3000, 'library'),
    createAsset('img-libunused', 'image/png', 9000, 'library'),
  ];

  it('keeps only non webp bitmaps that belong to the document', () => {
    const plan = planDocumentImageOptimization(assets, '![图](@images/img-used0001){w=400}', createTheme());

    expect(plan.compressible.map((asset) => asset.id)).toEqual([
      'img-used0001',
      'img-unused001',
      'img-libused01',
    ]);
    expect(plan.unused.map((asset) => asset.id)).toEqual(['img-unused001', 'img-webp00001', 'img-vector001']);
    expect(plan.totalCount).toBe(5);
    expect(plan.totalBytes).toBe(10300);
    expect(plan.unusedBytes).toBe(3300);
  });

  it('treats unreferenced library assets as unrelated to the document', () => {
    const plan = planDocumentImageOptimization(
      assets,
      '',
      createTheme({ cover: '@images/img-absent01', header: '@library/img-absent01' }),
    );

    expect(plan.compressible.map((asset) => asset.id)).toEqual(['img-used0001', 'img-unused001']);
    expect(plan.unused.map((asset) => asset.id)).toEqual([
      'img-used0001',
      'img-unused001',
      'img-webp00001',
      'img-vector001',
    ]);
    expect(plan.totalCount).toBe(4);
  });
});
