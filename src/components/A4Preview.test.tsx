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
  it('returns pages with oversized sheets or clipped content', () => {
    const sheets = [
      { offsetHeight: 1124, clientHeight: 1124, scrollHeight: 1124, dataset: { pageNum: '1' } },
      { offsetHeight: 1124, clientHeight: 1124, scrollHeight: 1240, dataset: { pageNum: '2' } },
      { offsetHeight: 1280, clientHeight: 1280, scrollHeight: 1280, dataset: { pageNum: '4' } },
    ] as unknown as HTMLElement[];

    expect(getOverflowPageNumbers(sheets)).toEqual([2, 4]);
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
});