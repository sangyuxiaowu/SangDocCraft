import { describe, expect, it } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { getRegisteredThemes } from '../themes/themeRegistry';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';
import type { SangDocument } from '../types';
import { createDocumentAsset, packSangDocument, SANG_DOCUMENT_FORMAT_VERSION, unpackSangDocument } from './documentPackage';

describe('SangDocCraft document package', () => {
  const meta = { ...DEFAULT_DOCUMENT_META, title: '测试文档', author: '测试作者' };

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
      meta,
      theme: getRegisteredThemes()[0],
      settings: { historyEnabled: true, historyIdleMinutes: 10 },
      history: [],
      chatSessions: [{
        id: 'session-1',
        documentId: 'doc-test',
        title: '测试对话',
        createdAt: '2026-09-15T00:30:00.000Z',
        updatedAt: '2026-09-15T00:40:00.000Z',
        messages: [{ role: 'assistant', content: '已完成文档检查。' }],
      }],
      assets: [asset, { ...asset, fileName: 'duplicate.png' }],
    };

    const packed = packSangDocument(document);
    const files = unzipSync(packed);
    expect(JSON.parse(new TextDecoder().decode(files['manifest.json'])).formatVersion).toBe(SANG_DOCUMENT_FORMAT_VERSION);
    expect(JSON.parse(new TextDecoder().decode(files['meta.json']))).toEqual(meta);
    expect(JSON.parse(new TextDecoder().decode(files['theme.json']))).not.toHaveProperty('meta');
    expect(Object.keys(files).filter((path) => path.startsWith('images/'))).toHaveLength(1);

    const unpacked = await unpackSangDocument(packed);
    expect(unpacked).toMatchObject({
      id: document.id,
      title: document.title,
      markdown: document.markdown,
      meta: document.meta,
      theme: document.theme,
      settings: document.settings,
      history: document.history,
      chatSessions: document.chatSessions,
    });
    expect(unpacked.assets).toHaveLength(1);
    expect(unpacked.assets[0].description).toBe('项目标志');
    expect([...unpacked.assets[0].data]).toEqual([...data]);

    delete files['chats.json'];
    const legacyUnpacked = await unpackSangDocument(zipSync(files));
    expect(legacyUnpacked.chatSessions).toEqual([]);
  });

  it('rejects a package with missing required files', async () => {
    await expect(unpackSangDocument(packSangDocument({
      id: 'doc-empty',
      title: '空文档',
      createdAt: '2026-09-15T00:00:00.000Z',
      modifiedAt: '2026-09-15T00:00:00.000Z',
      markdown: '',
      meta,
      theme: getRegisteredThemes()[0],
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
      chatSessions: [],
      assets: [],
    }).slice(0, 10))).rejects.toThrow('有效的 .sdc 文件');
  });

  it('opens legacy themes without a cover configuration', async () => {
    const document: SangDocument = {
      id: 'doc-legacy',
      title: '旧版文档',
      createdAt: '2026-09-15T00:00:00.000Z',
      modifiedAt: '2026-09-15T00:00:00.000Z',
      markdown: '# 旧版文档',
      meta,
      theme: getRegisteredThemes()[0],
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
      chatSessions: [],
      assets: [],
    };
    const files = unzipSync(packSangDocument(document));
    const legacyTheme = { ...document.theme, meta: { ...document.meta, logoUrl: 'https://example.com/old-logo.png' } } as Record<string, unknown>;
    delete legacyTheme.cover;
    delete files['meta.json'];
    files['manifest.json'] = strToU8(JSON.stringify({ ...JSON.parse(new TextDecoder().decode(files['manifest.json'])), formatVersion: 1 }));
    files['theme.json'] = strToU8(JSON.stringify(legacyTheme));

    const unpacked = await unpackSangDocument(zipSync(files));

    expect(unpacked.theme.cover).toEqual({
      ...getRegisteredThemes()[0].cover,
      logoUrl: 'https://example.com/old-logo.png',
    });
    expect(unpacked.meta.title).toBe(document.meta.title);
    expect(unpacked.meta).not.toHaveProperty('logoUrl');
    expect(unpacked.theme).not.toHaveProperty('meta');
  });
});