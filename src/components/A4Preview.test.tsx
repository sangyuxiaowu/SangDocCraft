// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { A4Preview, getFigureViewportRect, getMarkdownPositionForPreviewLocation, getMarkdownPositionForPreviewPage, getOverflowPageNumbers, getPreviewPageLocation, RenderedMarkdownPage } from './A4Preview';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';
import { getRegisteredThemes } from '../themes/themeRegistry';
import * as markdownParser from '../utils/markdownParser';
import * as mathRenderer from '../utils/mathRenderer';
import { registerAssetUrl, unregisterAssetUrl } from '../utils/assetUrlRegistry';

describe('A4Preview asynchronous pagination', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let theme: ReturnType<typeof getRegisteredThemes>[number];

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(markdownParser, 'paginateContentByDom').mockImplementation((markdown) => [markdown]);
    theme = structuredClone(getRegisteredThemes()[0]);
    theme.cover.showCover = false;
    theme.toc.show = false;
    theme.pageLayout = { margins: { top: 20, right: 15, bottom: 20, left: 15 }, showSafeMarginGuides: false };
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    unregisterAssetUrl('@images/pagination-test');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const loadImage = (image: HTMLImageElement, width = 600, height = 400) => {
    Object.defineProperties(image, {
      naturalWidth: { value: width }, naturalHeight: { value: height }, complete: { value: true },
    });
    image.dispatchEvent(new Event('load'));
  };

  it('renders both parts of a split bold paragraph without exposing Markdown delimiters', async () => {
    vi.mocked(markdownParser.paginateContentByDom).mockImplementation((_markdown, options) => {
      options?.onParagraphSplit?.(0, '**', '**');
      options?.onParagraphContinuation?.(1);
      return ['**加粗前半', '加粗后半**'];
    });
    await act(async () => root.render(<A4Preview markdown="**加粗前半加粗后半**" meta={DEFAULT_DOCUMENT_META} theme={theme} />));
    const bodies = Array.from(container.querySelectorAll('.markdown-rendered-body'));
    expect(bodies.map(body => body.querySelector('strong')?.textContent)).toEqual(['加粗前半', '加粗后半']);
    expect(bodies.map(body => body.textContent).join('')).not.toContain('**');
    expect(bodies[1].querySelector('p')?.classList.contains('p-continuation')).toBe(true);
  });

  it('renders every part of a paginated link with the same clickable target', async () => {
    const href = 'https://baike.baidu.com/item/beijing';
    vi.mocked(markdownParser.paginateContentByDom).mockImplementation((_markdown, options) => {
      options?.onParagraphSplit?.(0, `](${href})`, '[');
      options?.onParagraphContinuation?.(1);
      return [`产品认证 [百度`, `百科](${href}) 信息`];
    });
    await act(async () => root.render(<A4Preview markdown={`产品认证 [百度百科](${href}) 信息`} meta={DEFAULT_DOCUMENT_META} theme={theme} />));
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('.markdown-rendered-body a'));
    expect(links.map(link => link.textContent)).toEqual(['百度', '百科']);
    expect(links.every(link => link.getAttribute('href') === href)).toBe(true);
  });

  it('remeasures after each image loads, including nodes replaced by an earlier pagination', async () => {
    const markdown = '![](https://example.test/pagination-first.png)\n\n![](https://example.test/pagination-second.png)';
    await act(async () => root.render(<A4Preview markdown={markdown} meta={DEFAULT_DOCUMENT_META} theme={theme} />));
    const firstPass = vi.mocked(markdownParser.paginateContentByDom).mock.calls.length;
    await act(async () => loadImage(container.querySelector('img.doc-image')!));
    expect(markdownParser.paginateContentByDom).toHaveBeenCalledTimes(firstPass + 1);
    await act(async () => loadImage(container.querySelectorAll<HTMLImageElement>('img.doc-image')[1]));
    expect(markdownParser.paginateContentByDom).toHaveBeenCalledTimes(firstPass + 2);
  });

  it('remeasures an already loaded image without waiting for an animation frame', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(500);
    await act(async () => root.render(<A4Preview markdown="![](https://example.test/pagination-cached.png)" meta={DEFAULT_DOCUMENT_META} theme={theme} />));
    expect(markdownParser.paginateContentByDom).toHaveBeenCalledTimes(2);
  });

  it('replaces the rendered URL and remeasures when an asset changes without changing markdown or style', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:pagination-original').mockReturnValueOnce('blob:pagination-compressed');
    const asset = {
      id: 'pagination-test', scope: 'document' as const, fileName: 'image.png', description: '',
      mediaType: 'image/png', byteLength: 1, sha256: '', data: new Uint8Array([1]),
    };
    registerAssetUrl(asset);
    const markdown = '![](@images/pagination-test)';
    await act(async () => root.render(<A4Preview markdown={markdown} meta={DEFAULT_DOCUMENT_META} theme={theme} assetRevision={asset} />));
    const firstPass = vi.mocked(markdownParser.paginateContentByDom).mock.calls.length;
    const compressed = { ...asset, mediaType: 'image/webp', data: new Uint8Array([2]) };
    registerAssetUrl(compressed);
    await act(async () => root.render(<A4Preview markdown={markdown} meta={DEFAULT_DOCUMENT_META} theme={theme} assetRevision={compressed} />));
    expect(container.querySelector('img.doc-image')?.getAttribute('src')).toBe('blob:pagination-compressed');
    expect(markdownParser.paginateContentByDom).toHaveBeenCalledTimes(firstPass + 1);
    await act(async () => loadImage(container.querySelector('img.doc-image')!, 300, 200));
    expect(markdownParser.paginateContentByDom).toHaveBeenCalledTimes(firstPass + 2);
  });

  it('does not repaginate for cover metadata or header and footer text changes', async () => {
    theme.pageLayout = undefined;
    await act(async () => root.render(<A4Preview markdown="正文" meta={DEFAULT_DOCUMENT_META} theme={theme} />));
    const firstPass = vi.mocked(markdownParser.paginateContentByDom).mock.calls.length;
    await act(async () => root.render(<A4Preview markdown="正文" meta={{ ...DEFAULT_DOCUMENT_META, title: '新标题' }} theme={{
      ...theme,
      cover: { ...theme.cover, coverlist: [{ label: '项目', value: '新封面' }] },
      header: { ...theme.header, leftText: '新页眉' },
      footer: { ...theme.footer, leftText: '新页脚' },
    }} />));
    expect(markdownParser.paginateContentByDom).toHaveBeenCalledTimes(firstPass);
    expect(container.textContent).toContain('新页眉');
  });

  it('does not navigate from a preview that is behind the editor', async () => {
    const markdown = '# 标题\n\n正文';
    const getLatestMarkdown = vi.fn(() => `${markdown}新内容`);
    const onNavigateToEditor = vi.fn();
    await act(async () => root.render(<A4Preview markdown={markdown} meta={DEFAULT_DOCUMENT_META} theme={theme}
      getLatestMarkdown={getLatestMarkdown} onNavigateToEditor={onNavigateToEditor} />));
    const sheet = container.querySelector<HTMLElement>('[data-content-page-index]')!;
    await act(async () => sheet.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    expect(onNavigateToEditor).not.toHaveBeenCalled();
    getLatestMarkdown.mockReturnValue(markdown);
    await act(async () => sheet.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    expect(onNavigateToEditor).toHaveBeenCalledOnce();
  });

  it('does not apply figure edits from a preview that is behind the editor', async () => {
    const markdown = '![图片](https://example.test/figure.png)';
    const getLatestMarkdown = vi.fn(() => markdown);
    const onMarkdownChange = vi.fn();
    const elementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => container.querySelector('img.doc-image') });
    try {
      await act(async () => root.render(<A4Preview markdown={markdown} meta={DEFAULT_DOCUMENT_META} theme={theme}
        getLatestMarkdown={getLatestMarkdown} onMarkdownChange={onMarkdownChange} />));
      await act(async () => container.querySelector<HTMLImageElement>('img.doc-image')!.click());
      const alignButton = container.querySelector<HTMLButtonElement>('[aria-label="居中对齐"]')!;
      expect(alignButton).not.toBeNull();
      getLatestMarkdown.mockReturnValue(`${markdown}\n新内容`);
      await act(async () => alignButton.click());
      expect(onMarkdownChange).not.toHaveBeenCalled();
      getLatestMarkdown.mockReturnValue(markdown);
      await act(async () => alignButton.click());
      expect(onMarkdownChange).toHaveBeenCalledOnce();
    } finally {
      if (elementFromPoint) Object.defineProperty(document, 'elementFromPoint', elementFromPoint);
      else Reflect.deleteProperty(document, 'elementFromPoint');
    }
  });

  it('remeasures when fonts become ready and when later fonts finish loading', async () => {
    let finishFonts!: () => void;
    const fonts = Object.assign(new EventTarget(), { ready: new Promise<void>((resolve) => { finishFonts = resolve; }) });
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
    try {
      await act(async () => root.render(<A4Preview markdown="Text" meta={DEFAULT_DOCUMENT_META} theme={theme} />));
      expect(markdownParser.paginateContentByDom).toHaveBeenCalledTimes(1);
      await act(async () => finishFonts());
      expect(markdownParser.paginateContentByDom).toHaveBeenCalledTimes(2);
      await act(async () => fonts.dispatchEvent(new Event('loadingdone')));
      expect(markdownParser.paginateContentByDom).toHaveBeenCalledTimes(3);
    } finally {
      Reflect.deleteProperty(document, 'fonts');
    }
  });

  it('remeasures when the math renderer becomes ready without a markdown edit', async () => {
    let finishMath!: () => void;
    vi.spyOn(mathRenderer, 'onMathReady').mockImplementation((callback) => { finishMath = callback; return () => {}; });
    vi.spyOn(mathRenderer, 'ensureMathLoaded').mockResolvedValue();
    await act(async () => root.render(<A4Preview markdown="$x$" meta={DEFAULT_DOCUMENT_META} theme={theme} />));
    const firstPass = vi.mocked(markdownParser.paginateContentByDom).mock.calls.length;
    await act(async () => finishMath());
    expect(markdownParser.paginateContentByDom).toHaveBeenCalledTimes(firstPass + 1);
  });
});

describe('getFigureViewportRect', () => {
  it.each([
    { visible: { left: 100, top: 50, right: 300, bottom: 150 }, expectedLeft: 100 },
    { visible: { left: 200, top: 100, right: 600, bottom: 300 }, expectedLeft: 200 },
  ])('selects the rectangle that actually hits the rendered image', ({ visible, expectedLeft }) => {
    const image = document.createElement('img');
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(new DOMRect(200, 100, 400, 200));
    const original = document.elementFromPoint;
    document.elementFromPoint = vi.fn((x, y) => (
      x >= visible.left && x <= visible.right && y >= visible.top && y <= visible.bottom ? image : null
    ));
    try {
      expect(getFigureViewportRect(image, 0.5).left).toBe(expectedLeft);
    } finally {
      document.elementFromPoint = original;
    }
  });
});

describe('getMarkdownPositionForPreviewPage', () => {
  it('maps a preview page to the first source character on that page', () => {
    const markdown = 'first paragraph\n\nsecond paragraph\n\nthird paragraph';
    const pages = ['first paragraph\n\nsecond paragraph', 'third paragraph'];

    expect(getMarkdownPositionForPreviewPage(markdown, pages, 1)).toBe(markdown.indexOf('third'));
  });

  it('skips explicit page-break markers when locating a page start', () => {
    const markdown = 'first\n\n<!-- pagebreak -->\n\nsecond';
    const pages = ['first', 'second'];

    expect(getMarkdownPositionForPreviewPage(markdown, pages, 1)).toBe(markdown.indexOf('second'));
  });

  it('maps progress within a preview page back to the source', () => {
    const markdown = 'first\nsecond\nthird';
    const pages = ['first', 'second\nthird'];

    expect(getMarkdownPositionForPreviewLocation(markdown, pages, 1, 0.5)).toBe(markdown.indexOf('third'));
  });
});

describe('getPreviewPageLocation', () => {
  it('maps a cursor offset to its preview page and relative position', () => {
    const markdown = 'first paragraph\n\nsecond paragraph\n\nthird paragraph';
    const pages = ['first paragraph\n\nsecond paragraph', 'third paragraph'];

    expect(getPreviewPageLocation(markdown, pages, markdown.indexOf('second'))).toEqual({
      pageIndex: 0,
      pageProgress: 14 / 29,
    });
    expect(getPreviewPageLocation(markdown, pages, markdown.indexOf('third'))).toEqual({
      pageIndex: 1,
      pageProgress: 0,
    });
  });

  it('does not count explicit page-break markers as preview content', () => {
    const markdown = 'first\n\n<!-- pagebreak -->\n\nsecond';
    const pages = ['first', 'second'];

    expect(getPreviewPageLocation(markdown, pages, markdown.indexOf('second'))).toEqual({
      pageIndex: 1,
      pageProgress: 0,
    });
  });
});

describe('getOverflowPageNumbers', () => {
  it.each([0, -5000, -15000])('does not report a footerless cover above the viewport at y=%i', (top) => {
    const sheet = document.createElement('div');
    sheet.dataset.pageNum = '1';
    sheet.style.cssText = 'height:1122.5px;padding-bottom:75px;box-sizing:border-box;';
    sheet.innerHTML = '<div data-page-main></div>';
    document.body.appendChild(sheet);
    const main = sheet.firstElementChild as HTMLElement;
    Object.defineProperties(sheet, { offsetHeight: { value: 1123 }, clientHeight: { value: 1123 }, scrollHeight: { value: 1123 } });
    Object.defineProperties(main, { clientHeight: { value: 972 }, scrollHeight: { value: 972 } });
    vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, top, 794, 1122.5));
    const mainRect = vi.spyOn(main, 'getBoundingClientRect');
    try {
      mainRect.mockReturnValue(new DOMRect(0, top + 75, 680, 972.5));
      expect(getOverflowPageNumbers([sheet])).toEqual([]);
      mainRect.mockReturnValue(new DOMRect(0, top + 75, 680, 975));
      expect(getOverflowPageNumbers([sheet])).toEqual([1]);
    } finally {
      sheet.remove();
    }
  });

  it('returns pages with oversized sheets or clipped content', () => {
    const sheets = [
      { offsetHeight: 1124, clientHeight: 1124, scrollHeight: 1124, dataset: { pageNum: '1' } },
      { offsetHeight: 1124, clientHeight: 1124, scrollHeight: 1240, dataset: { pageNum: '2' } },
      { offsetHeight: 1280, clientHeight: 1280, scrollHeight: 1280, dataset: { pageNum: '4' } },
    ].map(sheet => ({ ...sheet, querySelector: () => null })) as unknown as HTMLElement[];

    expect(getOverflowPageNumbers(sheets)).toEqual([2, 4]);
  });

  it.each([0.5, 0.8, 1, 1.5])('allows 1.5px rounding but detects larger bottom margin intrusion at scale %s', (scale) => {
    const sheet = document.createElement('div');
    sheet.dataset.pageNum = '8';
    sheet.style.cssText = 'height:1122.5px;padding-bottom:75px;box-sizing:border-box;';
    sheet.innerHTML = '<div data-page-main></div><div data-page-footer></div>';
    document.body.appendChild(sheet);
    const main = sheet.querySelector<HTMLElement>('[data-page-main]')!;
    const footer = sheet.querySelector<HTMLElement>('[data-page-footer]')!;
    Object.defineProperties(sheet, { offsetHeight: { value: 1123 }, clientHeight: { value: 1123 }, scrollHeight: { value: 1123 } });
    vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 794 * scale, 1122.5 * scale));
    vi.spyOn(main, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 75 * scale, 680 * scale, 900 * scale));
    const footerRect = vi.spyOn(footer, 'getBoundingClientRect');
    try {
      footerRect.mockReturnValue(new DOMRect(0, 1025 * scale, 680 * scale, 27.5 * scale));
      expect(getOverflowPageNumbers([sheet])).toEqual([8]);
      footerRect.mockReturnValue(new DOMRect(0, 1025 * scale, 680 * scale, 23 * scale));
      expect(getOverflowPageNumbers([sheet])).toEqual([]);
      for (const excess of [1.007496, 1.5, 1.51]) {
        footerRect.mockReturnValue(new DOMRect(0, 1025 * scale, 680 * scale, (22.5 + excess) * scale));
        expect(getOverflowPageNumbers([sheet])).toEqual(excess <= 1.5 ? [] : [8]);
      }
    } finally {
      sheet.remove();
    }
  });

  it('detects clipped main content even when the sheet itself has no scroll overflow', () => {
    const sheet = document.createElement('div');
    sheet.dataset.pageNum = '2';
    sheet.innerHTML = '<div data-page-main></div>';
    const main = sheet.firstElementChild!;
    Object.defineProperties(main, { clientHeight: { value: 800 }, scrollHeight: { value: 830 } });
    expect(getOverflowPageNumbers([sheet])).toEqual([2]);
  });

  it.each([1, 2])('applies the same tolerance to %ipx of sheet and main scroll overflow', (excess) => {
    const sheet = document.createElement('div');
    sheet.dataset.pageNum = '10';
    sheet.innerHTML = '<div data-page-main></div>';
    Object.defineProperties(sheet, { clientHeight: { value: 1123 }, scrollHeight: { value: 1123 + excess, configurable: true } });
    expect(getOverflowPageNumbers([sheet])).toEqual(excess <= 1.5 ? [] : [10]);
    Object.defineProperty(sheet, 'scrollHeight', { value: 1123 });
    const main = sheet.firstElementChild!;
    Object.defineProperties(main, { clientHeight: { value: 800 }, scrollHeight: { value: 800 + excess } });
    expect(getOverflowPageNumbers([sheet])).toEqual(excess <= 1.5 ? [] : [10]);
  });
});

describe('RenderedMarkdownPage', () => {
  const roots: ReturnType<typeof createRoot>[] = [];

  afterEach(() => {
    roots.forEach((root) => root.unmount());
    roots.length = 0;
    document.body.innerHTML = '';
  });

  it('preserves Mermaid DOM mutations when parent state rerenders with unchanged HTML', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    const props = {
      html: '<div class="mermaid">flowchart LR\nA --> B</div>',
      primaryColor: '#2563eb',
      accentColor: '#0ea5e9',
      bulletChar: '•',
    };

    await act(async () => root.render(<RenderedMarkdownPage {...props} />));
    const mermaid = container.querySelector<HTMLElement>('.mermaid')!;
    mermaid.innerHTML = '<svg data-rendered="true"></svg>';

    await act(async () => root.render(<RenderedMarkdownPage {...props} />));

    expect(container.querySelector('[data-rendered="true"]')).not.toBeNull();
    expect(container.textContent).not.toContain('flowchart LR');
  });

  it('injects all four document colors and supplies a default image border', async () => {
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container); roots.push(root);
    const props = {
      html: '<section data-sdc-html><p>Text</p></section>',
      primaryColor: '#112233',
      accentColor: '#445566',
      textColor: '#778899',
      textSecondaryColor: '#667788',
      textMutedColor: '#8899aa',
      borderColor: '#bbccdd',
      borderLightColor: '#ddeeff',
      imgBorderColor: '#aabbcc',
      bulletChar: '*',
    };
    await act(async () => root.render(<RenderedMarkdownPage {...props} />));
    const body = container.querySelector<HTMLElement>('.markdown-rendered-body')!;
    expect(body.style.getPropertyValue('--primary-color')).toBe('#112233');
    expect(body.style.getPropertyValue('--accent-color')).toBe('#445566');
    expect(body.style.getPropertyValue('--text-color')).toBe('#778899');
    expect(body.style.getPropertyValue('--text-secondary')).toBe('#667788');
    expect(body.style.getPropertyValue('--text-muted')).toBe('#8899aa');
    expect(body.style.getPropertyValue('--border-color')).toBe('#bbccdd');
    expect(body.style.getPropertyValue('--border-light')).toBe('#ddeeff');
    expect(body.style.getPropertyValue('--img-border-color')).toBe('#aabbcc');
    await act(async () => root.render(<RenderedMarkdownPage {...props} textColor="#123456" imgBorderColor={undefined} />));
    expect(body.style.getPropertyValue('--text-color')).toBe('#123456');
    expect(body.style.getPropertyValue('--img-border-color')).toBe('#cbd5e1');
  });
});