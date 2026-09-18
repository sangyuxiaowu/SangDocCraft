// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { getOverflowPageNumbers, getPreviewPageLocation, RenderedMarkdownPage } from './A4Preview';

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
  it('returns only the page numbers whose rendered height exceeds A4', () => {
    const sheets = [
      { offsetHeight: 1124, dataset: { pageNum: '1' } },
      { offsetHeight: 1125, dataset: { pageNum: '2' } },
      { offsetHeight: 1280, dataset: { pageNum: '4' } },
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