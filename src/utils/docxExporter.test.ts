// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { PRESET_THEMES } from '../data/presetThemes';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';
import { exportToDocx } from './docxExporter';

vi.mock('./mermaidRenderer', async (importOriginal) => ({
  ...await importOriginal<typeof import('./mermaidRenderer')>(),
  renderMermaidPng: vi.fn(async () => ({
    data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    width: 24,
    height: 24,
  })),
}));

vi.mock('./tauriHelper', async (importOriginal) => ({
  ...await importOriginal<typeof import('./tauriHelper')>(),
  fetchImageBinary: vi.fn(async () => ({
    data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer,
    contentType: 'image/png',
  })),
}));

afterEach(() => vi.restoreAllMocks());

it('exports a Mermaid caption with the shared figure number into DOCX', async () => {
  let exportedBlob: Blob | undefined;
  vi.stubGlobal('URL', {
    createObjectURL: (blob: Blob) => { exportedBlob = blob; return 'blob:document'; },
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const base = PRESET_THEMES[0];
  const theme = {
    ...base,
    cover: { ...base.cover, showCover: false },
    toc: { ...base.toc, show: false },
  };

  try {
    await exportToDocx(
      '<!-- caption: 数据处理结构 -->\n\n```mermaid\nflowchart LR\nA --> B\n```\n\n![后续图片](a.png){align=right}',
      DEFAULT_DOCUMENT_META,
      theme,
    );
    expect(exportedBlob).toBeDefined();
    const files = unzipSync(new Uint8Array(await exportedBlob!.arrayBuffer()));
    const xml = strFromU8(files['word/document.xml']);
    expect(xml).toContain('图 1: 数据处理结构');
    expect(xml).toContain('图 2: 后续图片');
    expect(xml).not.toContain('<!-- caption:');
    expect(xml).not.toContain('{align=right}');
    expect(xml).toMatch(/<w:p>\s*<w:pPr>[\s\S]*?<w:jc w:val="right"\/>[\s\S]*?<\/w:pPr>[\s\S]*?<wp:docPr[^>]*descr="后续图片"/);
  } finally {
    vi.unstubAllGlobals();
  }
});