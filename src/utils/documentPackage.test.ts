import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { getRegisteredThemes } from '../themes/themeRegistry';
import type { SangDocument } from '../types';
import { createDocumentAsset, packSangDocument, unpackSangDocument } from './documentPackage';

describe('SangDocCraft document package', () => {
  it('round-trips document content and stores duplicate image data once', async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const asset = await createDocumentAsset(data, {
      fileName: 'logo.png',
      description: '项目标志',
      mediaType: 'image/png',
    });
    const document: SangDocument = {
      id: 'doc-test',
      title: '测试文档',
      createdAt: '2026-09-15T00:00:00.000Z',
      modifiedAt: '2026-09-15T01:00:00.000Z',
      markdown: `# 测试\n\n![标志](@images/${asset.id})`,
      theme: getRegisteredThemes()[0],
      settings: { historyEnabled: true, historyIdleMinutes: 10 },
      assets: [asset, { ...asset, fileName: 'duplicate.png' }],
    };

    const packed = packSangDocument(document);
    const files = unzipSync(packed);
    expect(Object.keys(files).filter((path) => path.startsWith('images/'))).toHaveLength(1);

    const unpacked = await unpackSangDocument(packed);
    expect(unpacked).toMatchObject({
      id: document.id,
      title: document.title,
      markdown: document.markdown,
      theme: document.theme,
      settings: document.settings,
    });
    expect(unpacked.assets).toHaveLength(1);
    expect(unpacked.assets[0].description).toBe('项目标志');
    expect([...unpacked.assets[0].data]).toEqual([...data]);
  });

  it('rejects a package with missing required files', async () => {
    await expect(unpackSangDocument(packSangDocument({
      id: 'doc-empty',
      title: '空文档',
      createdAt: '2026-09-15T00:00:00.000Z',
      modifiedAt: '2026-09-15T00:00:00.000Z',
      markdown: '',
      theme: getRegisteredThemes()[0],
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      assets: [],
    }).slice(0, 10))).rejects.toThrow('有效的 .sdc 文件');
  });
});