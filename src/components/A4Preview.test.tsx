// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFigureViewportRect, getMarkdownPositionForPreviewLocation, getMarkdownPositionForPreviewPage, getOverflowPageNumbers, getPreviewPageLocation, RenderedMarkdownPage } from './A4Preview';

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