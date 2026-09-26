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

it.each(['light', 'dark'] as const)('exports editable %s highlighted SQL with blank lines', async (codeTheme) => {
  let exportedBlob: Blob | undefined;
  vi.stubGlobal('URL', {
    createObjectURL: (blob: Blob) => { exportedBlob = blob; return 'blob:document'; },
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const base = PRESET_THEMES[0];
  try {
    await exportToDocx('```sql\n  SELECT name FROM users;\n\nWHERE id = 1;\n```', DEFAULT_DOCUMENT_META, {
      ...base,
      style: { ...base.style, codeTheme },
      cover: { ...base.cover, showCover: false },
      toc: { ...base.toc, show: false },
    });
    const files = unzipSync(new Uint8Array(await exportedBlob!.arrayBuffer()));
    const xml = new DOMParser().parseFromString(strFromU8(files['word/document.xml']), 'application/xml');
    const paragraphs = Array.from(xml.getElementsByTagName('w:p'))
      .filter(paragraph => paragraph.getElementsByTagName('w:shd').length > 0);
    expect(paragraphs.map(paragraph => Array.from(paragraph.getElementsByTagName('w:t'))
      .map(text => text.textContent).join(''))).toEqual(['  SELECT name FROM users;', '', 'WHERE id = 1;']);
    expect(paragraphs[0].getElementsByTagName('w:t')[0]?.getAttribute('xml:space')).toBe('preserve');
    expect(paragraphs[0].getElementsByTagName('w:r').length).toBeGreaterThan(1);
    const keywordRun = Array.from(paragraphs[0].getElementsByTagName('w:r'))
      .find(run => run.getElementsByTagName('w:t')[0]?.textContent === 'SELECT');
    expect(keywordRun?.getElementsByTagName('w:color')[0]?.getAttribute('w:val'))
      .toBe(codeTheme === 'light' ? 'A21CAF' : 'F0ABFC');
    expect(paragraphs[0].getElementsByTagName('w:shd')[0]?.getAttribute('w:fill'))
      .toBe(codeTheme === 'light' ? 'F1F5F9' : '0F172A');
  } finally {
    vi.unstubAllGlobals();
  }
});

it('preserves unknown-language code literally without embedding HTML markup', async () => {
  let exportedBlob: Blob | undefined;
  vi.stubGlobal('URL', {
    createObjectURL: (blob: Blob) => { exportedBlob = blob; return 'blob:document'; },
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const base = PRESET_THEMES[0];
  try {
    await exportToDocx('```not-a-language\n  <tag> & text\n```', DEFAULT_DOCUMENT_META, {
      ...base,
      cover: { ...base.cover, showCover: false },
      toc: { ...base.toc, show: false },
    });
    const files = unzipSync(new Uint8Array(await exportedBlob!.arrayBuffer()));
    const xml = new DOMParser().parseFromString(strFromU8(files['word/document.xml']), 'application/xml');
    const code = Array.from(xml.getElementsByTagName('w:p'))
      .find(paragraph => paragraph.getElementsByTagName('w:shd').length > 0);
    expect(code?.getElementsByTagName('w:t')[0]?.textContent).toBe('  <tag> & text');
    expect(code?.getElementsByTagName('w:r').length).toBe(1);
  } finally {
    vi.unstubAllGlobals();
  }
});

it('separates code blocks from each other and surrounding text without spacing their lines', async () => {
  let exportedBlob: Blob | undefined;
  vi.stubGlobal('URL', {
    createObjectURL: (blob: Blob) => { exportedBlob = blob; return 'blob:document'; },
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const base = PRESET_THEMES[0];
  try {
    await exportToDocx('Before\n\n```json\n{\n  "ok": true\n}\n```\n\n```ts\nconst done = true;\n```\n\nAfter', DEFAULT_DOCUMENT_META, {
      ...base,
      cover: { ...base.cover, showCover: false },
      toc: { ...base.toc, show: false },
    });
    const files = unzipSync(new Uint8Array(await exportedBlob!.arrayBuffer()));
    const xml = new DOMParser().parseFromString(strFromU8(files['word/document.xml']), 'application/xml');
    const codeParagraphs = Array.from(xml.getElementsByTagName('w:p'))
      .filter(paragraph => paragraph.getElementsByTagName('w:shd').length > 0);
    const spacing = codeParagraphs.map(paragraph => {
      const element = paragraph.getElementsByTagName('w:spacing')[0];
      return [element?.getAttribute('w:before'), element?.getAttribute('w:after')];
    });
    expect(spacing).toEqual([['0', '0'], ['0', '0'], ['0', '0'], ['0', '0']]);
    const paragraphs = Array.from(xml.getElementsByTagName('w:p'));
    const codeIndexes = codeParagraphs.map(paragraph => paragraphs.indexOf(paragraph));
    const isSpacer = (paragraph: Element | undefined) => paragraph?.getElementsByTagName('w:shd').length === 0
      && paragraph.getElementsByTagName('w:spacing')[0]?.getAttribute('w:before') === '160'
      && paragraph.getElementsByTagName('w:t')[0]?.textContent === ' ';
    expect(isSpacer(paragraphs[codeIndexes[0] - 1])).toBe(true);
    expect(codeIndexes[1] - codeIndexes[0]).toBe(1);
    expect(codeIndexes[2] - codeIndexes[1]).toBe(1);
    expect(codeIndexes[3] - codeIndexes[2]).toBe(2);
    expect(isSpacer(paragraphs[codeIndexes[2] + 1])).toBe(true);
    expect(isSpacer(paragraphs[codeIndexes[3] + 1])).toBe(true);
  } finally {
    vi.unstubAllGlobals();
  }
});

it('exports exact metadata references and Word chapter fields', async () => {
  let exportedBlob: Blob | undefined;
  vi.stubGlobal('URL', {
    createObjectURL: (blob: Blob) => { exportedBlob = blob; return 'blob:document'; },
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const base = PRESET_THEMES[0];
  try {
    await exportToDocx('# 第一章\n\n## 第二节', { ...DEFAULT_DOCUMENT_META, title: '动态标题' }, {
      ...base,
      cover: { ...base.cover, coverlist: [{ label: '标题', value: '@title' }] },
      header: { ...base.header, show: true, leftText: '@h1', centerText: '@title', rightText: '文字@title' },
      footer: { ...base.footer, show: true, leftText: '@h2', centerText: '@number', rightText: '@version' },
    });
    const files = unzipSync(new Uint8Array(await exportedBlob!.arrayBuffer()));
    const xml = strFromU8(files['word/document.xml']);
    const headers = Object.entries(files).filter(([name]) => /^word\/header\d+\.xml$/.test(name))
      .map(([, bytes]) => strFromU8(bytes)).join('');
    const footers = Object.entries(files).filter(([name]) => /^word\/footer\d+\.xml$/.test(name))
      .map(([, bytes]) => strFromU8(bytes)).join('');
    expect(xml).toContain('动态标题');
    expect(headers).toContain('STYLEREF');
    expect(headers).toContain('Heading 1');
    expect(headers).toContain('文字@title');
    expect(headers).toContain('动态标题');
    expect(footers).toContain('Heading 2');
    expect(footers).not.toContain('>@h2<');
  } finally {
    vi.unstubAllGlobals();
  }
});

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

it('falls back to the first-level Word field when no second-level heading exists', async () => {
  let exportedBlob: Blob | undefined;
  vi.stubGlobal('URL', {
    createObjectURL: (blob: Blob) => { exportedBlob = blob; return 'blob:document'; },
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const base = PRESET_THEMES[0];
  try {
    await exportToDocx('# 第一章', DEFAULT_DOCUMENT_META, {
      ...base,
      cover: { ...base.cover, showCover: false },
      toc: { ...base.toc, show: false },
      header: { ...base.header, show: true, leftText: '@h2' },
    });
    const files = unzipSync(new Uint8Array(await exportedBlob!.arrayBuffer()));
    const headers = Object.entries(files).filter(([name]) => /^word\/header\d+\.xml$/.test(name))
      .map(([, bytes]) => strFromU8(bytes)).join('');
    expect(headers).toContain('STYLEREF');
    expect(headers).toContain('Heading 1');
    expect(headers).not.toContain('Heading 2');
  } finally {
    vi.unstubAllGlobals();
  }
});