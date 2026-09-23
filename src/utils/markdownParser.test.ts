// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { marked } from 'marked';
import { getPageBreakInsertion, splitExplicitPages } from './pageBreaks';
import { PRESET_THEMES } from '../data/presetThemes';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';
import {
  formatPageNumber,
  getFooterSlots,
  getHeadingText,
  getMarkdownBodyCss,
  getTocChunks,
  paginateContentByDom,
  paginateTocItemsByDom,
  parseTableOfContents,
  postProcessRenderedHtml,
  splitContentByPages,
} from './markdownParser';

const theme = PRESET_THEMES[0];

describe('Markdown pagination and numbering', () => {
  it('uses measured Mermaid heights instead of reserving the maximum height', () => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      const mermaid = this.querySelector<HTMLElement>('.mermaid');
      return this.querySelectorAll('h2').length * 300 + (mermaid ? Number.parseFloat(mermaid.style.height) || 180 : 0);
    });
    const source = '## Before\n\n```mermaid\nflowchart LR\nA --> B\n```\n\n## After';
    try {
      expect(paginateContentByDom(source, { style: theme.style })).toHaveLength(1);
      const measuredPages = paginateContentByDom(source, {
        style: theme.style,
        mermaidHeights: { 'flowchart LR\nA --> B': 700 },
      });
      expect(measuredPages.length).toBeGreaterThan(1);
      expect(measuredPages.join('\n')).toContain('A --> B');
    } finally {
      height.mockRestore();
    }
  });

  it('keeps a declared Mermaid height for pagination even after measuring the SVG', () => {
    const observedHeights: string[] = [];
    const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      const height = this.querySelector<HTMLElement>('.mermaid')?.style.height || '';
      if (height) observedHeights.push(height);
      return Number.parseFloat(height) || 180;
    });
    try {
      paginateContentByDom('```mermaid {h=320}\nflowchart LR\nA --> B\n```', {
        style: theme.style,
        mermaidHeights: { 'flowchart LR\nA --> B': 100 },
      });
      expect(observedHeights).toContain('320px');
      expect(observedHeights).not.toContain('180px');
    } finally {
      scrollHeight.mockRestore();
    }
  });

  it.each([4, 5])('measures %i list items with the same width and direct-child margins as the page', (itemCount) => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      expect(this.style.width).toBe('180mm');
      expect(this.style.display).toBe('flow-root');
      expect(this.querySelectorAll(':scope > div')).toHaveLength(0);
      return this.querySelectorAll('h1').length * 100 + this.querySelectorAll('li').length * 180;
    });
    try {
      const source = '# Conclusion\n\n' + Array.from({ length: itemCount }, (_, index) => `- Recommendation ${index + 1}`).join('\n');
      const pages = paginateContentByDom(source, { style: theme.style, h1PageBreak: true, headerShow: true, footerShow: true });
      expect(pages).toHaveLength(itemCount === 4 ? 1 : 2);
      expect(pages[0]).toContain('Recommendation 4');
      const items = pages.flatMap(page => marked.lexer(page).flatMap(token => token.type === 'list' ? token.items : []));
      expect(items.map(item => item.text)).toEqual(Array.from({ length: itemCount }, (_, index) => `Recommendation ${index + 1}`));
    } finally {
      height.mockRestore();
    }
    expect(document.querySelector('.pagination-measurer')).toBeNull();
  });

  it('reserves the rendered header, footer and one reflowed text line', () => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.querySelectorAll('p').length * 435;
    });
    try {
      const pages = paginateContentByDom('First paragraph\n\nSecond paragraph', {
        style: theme.style,
        headerShow: true,
        footerShow: true,
      });

      expect(pages).toEqual(['First paragraph', 'Second paragraph']);
    } finally {
      height.mockRestore();
    }
  });

  it('measures a table caption together with its table', () => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.querySelectorAll('p').length * 200
        + this.querySelectorAll('table').length * 350
        + this.querySelectorAll('.doc-table-caption').length * 400;
    });
    const source = 'Intro\n\n<!-- caption: Delivery formats -->\n| Format | Purpose |\n| --- | --- |\n| HTML | Archive |\n\nFollowing';
    try {
      const pages = paginateContentByDom(source, { style: theme.style });
      expect(pages).toHaveLength(3);
      expect(pages[1]).toContain('<!-- caption: Delivery formats -->');
      expect(pages[1]).toContain('| HTML | Archive |');
      expect(pages[2]).toBe('Following');
    } finally {
      height.mockRestore();
    }
  });

  it('starts image paragraphs on a fresh page before their dimensions are available', () => {
    const pages = paginateContentByDom(
      'Introductory content\n\n![Example](https://example.test/example.png)',
      { style: theme.style },
    );

    expect(pages).toEqual([
      'Introductory content',
      '![Example](https://example.test/example.png)',
    ]);
  });

  it('keeps a loaded image on the current page when it fits', () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    const naturalWidth = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1200);
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.querySelectorAll('p').length * 100 + this.querySelectorAll('img').length * 250;
    });
    try {
      const pages = paginateContentByDom('Intro\n\n![Example](https://example.test/image.png){w=520}\n\nFollowing', { style: theme.style });
      expect(pages).toHaveLength(1);
    } finally {
      complete.mockRestore();
      naturalWidth.mockRestore();
      height.mockRestore();
    }
  });

  it('keeps an image markdown expression intact when it overflows the remaining page space', () => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.querySelectorAll('h2').length * 900 + this.querySelectorAll('img').length * 200;
    });
    const imageMarkdown = '![网络图片与内部资源示例](https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&auto=format&fit=crop&q=80){w=520}';
    try {
      const pages = paginateContentByDom(`## 图片与内部资源\n\n${imageMarkdown}`, { style: theme.style });
      expect(pages).toHaveLength(2);
      expect(pages[1]).toBe(imageMarkdown);
      expect(marked.parse(pages[1])).toContain('<img');
    } finally {
      height.mockRestore();
    }
  });

  it('keeps image markdown intact in the non-DOM pagination fallback', () => {
    const imageMarkdown = '![架构图](https://example.com/architecture.png?w=1200&fit=crop){w=520}';
    const pages = splitContentByPages(`${'正文内容'.repeat(380)}\n\n${imageMarkdown}`);

    expect(pages.at(-1)).toBe(imageMarkdown);
    expect(marked.parse(pages.at(-1) || '')).toContain('<img');
  });

  it.each([
    ['| ID | Value |\n| --- | --- |\n| 1 | first |\n| 2 | second |', 'second'],
    ['| ID | Value |\r\n| --- | --- |\r\n| 1 | first |\r\n| 2 | second |\r\n', 'second'],
    ['ID | Value\n--- | ---\n1 | first\n2 | second', 'second'],
    ['9. first\n10. second', 'second'],
    ['- [x] first\n- [ ] second', 'second'],
  ])('inserts a toolbar break without damaging the containing row or item', (source, target) => {
    const insertion = getPageBreakInsertion(source, source.indexOf(target) + 2);
    const updated = source.slice(0, insertion.position) + insertion.text + source.slice(insertion.position);
    const pages = splitExplicitPages(updated);
    expect(pages).toHaveLength(2);
    expect(marked.parse(pages[0])).toContain('first');
    expect(marked.parse(pages[1])).toContain('second');
    expect(marked.lexer(pages[1])[0].type).toBe(source.includes('|') ? 'table' : 'list');
  });

  it('keeps empty tables and handles legacy HTML breaks adjacent to text', () => {
    expect(splitExplicitPages('| Header |\n| --- |')[0]).toContain('| Header |');
    expect(splitExplicitPages('First\n\n<div class="page-break"></div>\nSecond')).toEqual(['First', 'Second']);
    expect(splitExplicitPages('<pre>\n<!-- pagebreak -->\n</pre>')).toHaveLength(1);
  });

  it('moves a header-cell break before the entire table', () => {
    const pages = splitExplicitPages('Before\n\n| <!-- pagebreak --> ID | Value |\n| --- | --- |\n| 1 | kept |');
    expect(pages).toHaveLength(2);
    expect((marked.lexer(pages[1])[0] as import('marked').Tokens.Table).rows[0][1].text).toBe('kept');
    expect(pages.join('\n')).not.toContain('pagebreak');
  });

  it('uses only explicit boundaries in manual mode even with H1 breaks enabled', () => {
    const source = '# First\n\n' + 'Long paragraph. '.repeat(600) + '\n\n# Second\n\n<!-- pagebreak -->\n\n# Third';
    const options = { h1PageBreak: true, style: { ...theme.style, paginationMode: 'manual' as const } };
    expect(paginateContentByDom(source, options)).toHaveLength(2);
    expect(splitContentByPages(source, true, 'manual')).toHaveLength(2);
  });

  it('preserves table headers, alignment and escaped pipes across explicit row breaks', () => {
    const pages = splitExplicitPages('| ID | Value |\n| :--- | ---: |\n| 1 | a\\|b |\n<!-- pagebreak -->\n| 2 | second |\n| <!-- pagebreak --> 3 | third |');
    expect(pages).toHaveLength(3);
    const tables = pages.map(page => marked.lexer(page)[0] as import('marked').Tokens.Table);
    expect(tables.map(table => table.rows[0][0].text.trim())).toEqual(['1', '2', '3']);
    expect(tables[0].rows[0][1].text).toBe('a|b');
    expect(tables.every(table => table.align[1] === 'right')).toBe(true);
  });

  it('preserves nested task lists and ordered numbering around explicit breaks', () => {
    const pages = splitExplicitPages('9. first\n10. second\n    <!-- pagebreak -->\n    continuation\n    - [x] nested\n11. last');
    expect(pages).toHaveLength(2);
    expect(marked.parse(pages[1])).toContain('start="10"');
    expect(marked.parse(pages[1])).toContain('checked');
    expect(pages.join('\n')).toContain('continuation');
    expect(pages.join('\n')).toContain('last');
  });

  it('ignores break examples in code and avoids empty boundary pages', () => {
    const source = '<!-- pagebreak -->\n\n`<!-- pagebreak -->`\n\n```html\n<!-- pagebreak -->\n```\n\n    <!-- pagebreak -->\n\n<!-- pagebreak -->\n<!-- pagebreak -->';
    const pages = splitExplicitPages(source);
    expect(pages).toHaveLength(1);
    expect(marked.parse(pages[0])).toContain('&lt;!-- pagebreak --&gt;');
    expect(pages[0].match(/pagebreak/g)).toHaveLength(3);
  });

  it('repeatedly splits a table on empty continuation pages without losing rows', () => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.querySelectorAll('tr').length * 200 + this.querySelectorAll('h1').length * 100;
    });
    try {
      const markdown = '# Audit\n\n| ID | Value |\n| --- | --- |\n' +
        Array.from({ length: 17 }, (_, index) => `| ${index + 1} | Row ${index + 1} |`).join('\n');
      const pages = paginateContentByDom(markdown);
      expect(pages.length).toBeGreaterThan(2);
      const rows = pages.flatMap(page => marked.lexer(page).flatMap(token => token.type === 'table' ? token.rows : []));
      expect(rows.map(row => row[0].text)).toEqual(Array.from({ length: 17 }, (_, index) => String(index + 1)));
      pages.forEach(page => {
        const container = document.createElement('div');
        container.innerHTML = marked.parse(page) as string;
        expect(container.scrollHeight).toBeLessThanOrEqual(965.3);
      });
    } finally {
      height.mockRestore();
    }
  });

  it('reserves caption height when splitting a long table', () => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.querySelectorAll('tr').length * 200 + this.querySelectorAll('.doc-table-caption').length * 150;
    });
    try {
      const source = '<!-- caption: Audit -->\n| ID | Value |\n| --- | --- |\n'
        + Array.from({ length: 8 }, (_, index) => `| ${index + 1} | Entry |`).join('\n');
      const pages = paginateContentByDom(source, { style: theme.style });
      expect(pages.length).toBeGreaterThan(1);
      expect(pages.join('\n').match(/<!-- caption: Audit -->/g)).toHaveLength(1);
      expect(pages.flatMap(page => marked.lexer(page).flatMap(token => token.type === 'table' ? token.rows : []))
        .map(row => row[0].text)).toEqual(Array.from({ length: 8 }, (_, index) => String(index + 1)));
      pages.forEach(page => {
        const rendered = document.createElement('div');
        rendered.innerHTML = postProcessRenderedHtml(marked.parse(page) as string, theme.style);
        expect(rendered.scrollHeight).toBeLessThanOrEqual(880);
      });
    } finally {
      height.mockRestore();
    }
  });

  it('keeps a bottom table caption on the final table page', () => {
    const style = {
      ...theme.style,
      tableCaptionConfig: { ...theme.style.tableCaptionConfig!, captionPosition: 'bottom' as const },
    };
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.querySelectorAll('tr').length * 200 + this.querySelectorAll('.doc-table-caption').length * 150;
    });
    try {
      const source = '<!-- caption: Audit -->\n| ID | Value |\n| --- | --- |\n'
        + Array.from({ length: 8 }, (_, index) => `| ${index + 1} | Entry |`).join('\n');
      const pages = paginateContentByDom(source, { style });
      expect(pages.length).toBeGreaterThan(1);
      expect(pages.join('\n').match(/<!-- caption: Audit -->/g)).toHaveLength(1);
      expect(pages.at(-1)).toContain('<!-- caption: Audit -->');
      expect(pages.flatMap(page => marked.lexer(page).flatMap(token => token.type === 'table' ? token.rows : []))
        .map(row => row[0].text)).toEqual(Array.from({ length: 8 }, (_, index) => String(index + 1)));
      pages.forEach(page => {
        const rendered = document.createElement('div');
        rendered.innerHTML = postProcessRenderedHtml(marked.parse(page) as string, style);
        expect(rendered.scrollHeight).toBeLessThanOrEqual(880);
      });
    } finally {
      height.mockRestore();
    }
  });

  it('retains ordered list numbers through more than two automatic pages', () => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.querySelectorAll('li').length * 200;
    });
    try {
      const source = Array.from({ length: 17 }, (_, index) => `${index + 9}. item ${index}`).join('\n');
      const pages = paginateContentByDom(source);
      expect(pages).toHaveLength(5);
      expect(pages.map(page => (marked.lexer(page)[0] as import('marked').Tokens.List).start)).toEqual([9, 13, 17, 21, 25]);
    } finally {
      height.mockRestore();
    }
  });

  it('splits explicit page breaks without losing content', () => {
    const pages = splitContentByPages('First\n\n<!-- pagebreak -->\n\nSecond');
    expect(pages).toHaveLength(2);
    expect(pages.join('\n')).toContain('First');
    expect(pages.join('\n')).toContain('Second');
  });

  it('repeatedly splits long tables in the non-DOM fallback', () => {
    const source = '| ID | Value |\n| :--- | ---: |\n' + Array.from({ length: 100 }, (_, index) => `| ${index} | value\\|${index} |`).join('\n');
    const pages = splitContentByPages(source);
    expect(pages.length).toBeGreaterThan(2);
    const tables = pages.map(page => marked.lexer(page)[0] as import('marked').Tokens.Table);
    expect(tables.every(table => table.rows.length <= 34 && table.align[1] === 'right')).toBe(true);
    expect(tables.flatMap(table => table.rows).map(row => row[1].text)).toEqual(Array.from({ length: 100 }, (_, index) => `value|${index}`));
  });

  it('numbers headings and resets deeper counters', () => {
    const counters = [0, 0, 0, 0];
    expect(getHeadingText('One', 1, counters, 'decimal')).toBe('1. One');
    expect(getHeadingText('Child', 2, counters, 'decimal')).toBe('1.1. Child');
    expect(getHeadingText('Two', 1, counters, 'decimal')).toBe('2. Two');
    expect(counters).toEqual([2, 0, 0, 0]);
  });

  it('calculates TOC depth and page offsets from supplied pages', () => {
    const items = parseTableOfContents(
      '# One\n## Child\n### Hidden',
      2,
      { showCover: true },
      true,
      false,
      ['# One\n## Child', '### Hidden'],
      'decimal',
    );
    expect(items.map(({ text, pageNumber }) => ({ text, pageNumber }))).toEqual([
      { text: '1. One', pageNumber: 3 },
      { text: '1.1. Child', pageNumber: 3 },
    ]);
    expect(getTocChunks(Array.from({ length: 23 }, (_, index) => ({ id: `${index}`, text: '', level: 1 }))))
      .toHaveLength(2);
  });

  it('uses the measured TOC page count when assigning content page numbers', () => {
    const pages = ['# One\n## Child'];
    const auto = parseTableOfContents('# One\n## Child', 2, { showCover: true }, true, false, pages);
    const measured = parseTableOfContents('# One\n## Child', 2, { showCover: true }, true, false, pages, 'none', 3);

    expect(auto[0].pageNumber).toBe(3);
    expect(measured[0].pageNumber).toBe(5);
    expect(measured[1].pageNumber).toBe(5);
  });

  it('omits leading empty levels for decimal-skip-h1 without an h1', () => {
    const noH1 = [0, 0, 0, 0];
    expect(getHeadingText('Alpha', 2, noH1, 'decimal-skip-h1')).toBe('1 Alpha');
    expect(getHeadingText('Beta', 2, noH1, 'decimal-skip-h1')).toBe('2 Beta');

    const withH1 = [0, 0, 0, 0];
    expect(getHeadingText('Root', 1, withH1, 'decimal-skip-h1')).toBe('Root');
    expect(getHeadingText('Child', 2, withH1, 'decimal-skip-h1')).toBe('1.1 Child');
  });

  it('splits long TOC items by measured height instead of a fixed count', () => {
    const { toc, style } = theme;
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      const titleHeight = this.querySelector('.doc-toc-title') ? 100 : 0;
      return titleHeight + this.querySelectorAll(':scope > div').length * 200;
    });
    const items = Array.from({ length: 10 }, (_, index) => ({
      id: `heading-${index + 1}`,
      text: `章节标题 ${index + 1}`,
      level: 1,
    }));
    try {
      const chunks = paginateTocItemsByDom(items, { toc: { ...toc, maxDepth: 3 }, style });
      // 可用高度约 907px：首页预留 100px 标题后每页 4 项，后续页无标题每页 4 项
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.flat().map((item) => item.id)).toEqual(items.map((item) => item.id));
      expect(chunks[0]).toHaveLength(4);
    } finally {
      height.mockRestore();
    }
    expect(document.querySelector('.toc-pagination-measurer')).toBeNull();
  });

  it('re-measures TOC rows when the final page indicator changes', () => {
    const { toc, style } = theme;
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      const hasMultiPageIndicator = this.querySelector('.doc-toc-title span') !== null;
      return 700 + this.querySelectorAll(':scope > div').length * 100 + (hasMultiPageIndicator ? 100 : 0);
    });
    const items = Array.from({ length: 5 }, (_, index) => ({
      id: `heading-${index + 1}`,
      text: `章节标题 ${index + 1}`,
      level: 1,
    }));
    try {
      const chunks = paginateTocItemsByDom(items, {
        toc: { ...toc, titleOnEveryPage: true },
        style,
        headerShow: false,
        footerShow: false,
        coverPageCount: 1,
        contentPageCount: 9,
      });
      expect(chunks).toHaveLength(5);
      expect(chunks.every((chunk) => chunk.length === 1)).toBe(true);
    } finally {
      height.mockRestore();
    }
  });

  it.each([
    ['pageOfTotal', '第 2 页 / 共 5 页'],
    ['page', '第 2 页'],
    ['hyphen', '- 2 -'],
    ['simple', '2 / 5'],
    ['none', ''],
  ])('formats %s page numbers', (format, expected) => {
    expect(formatPageNumber(2, 5, format)).toBe(expected);
  });

  it('places the page number in the configured footer slot', () => {
    const slots = getFooterSlots(2, 5, { ...theme.footer, pageNumberPosition: 'center' }, DEFAULT_DOCUMENT_META);
    expect(slots.center).toBe('第 2 页 / 共 5 页');
    expect(slots.left).toBe(theme.footer.leftText || DEFAULT_DOCUMENT_META.organization);
  });
});

describe('Rendered Markdown post-processing', () => {
  it('converts Mermaid fences and applies the page-safe height limit', () => {
    const html = postProcessRenderedHtml('<pre><code class="language-mermaid">flowchart TD\nA--&gt;B</code></pre>');
    const css = getMarkdownBodyCss('.body', theme.style);
    expect(html).toContain('<div class="mermaid">flowchart TD');
    expect(html).not.toContain('language-mermaid');
    expect(css).toContain('max-height: 720px');
  });

  it('supports single-diagram fence attributes with custom theme, width, height, and alignment', () => {
    const markdown = '```mermaid {theme=dark w=520 h=320 align=center}\nflowchart LR\nA --> B\n```';
    const parsed = marked.parse(markdown) as string;
    const html = postProcessRenderedHtml(parsed, theme.style);

    expect(html).toContain('class="mermaid"');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-width="520"');
    expect(html).toContain('data-height="320"');
    expect(html).toContain('data-align="center"');
    expect(html).toContain('max-width: 520px');
    expect(html).toContain('max-height: 320px');
    expect(html).toContain('height: 320px');
    expect(html).toContain('justify-content: center');
  });

  it('resolves mermaid theme according to mermaidConfig or neutral fallback', () => {
    const markdown = '```mermaid {w=80% align=left}\nflowchart LR\nA --> B\n```';
    const parsed = marked.parse(markdown) as string;

    const darkHtml = postProcessRenderedHtml(parsed, theme.style, undefined, { theme: 'dark' });
    expect(darkHtml).toContain('data-theme="dark"');
    expect(darkHtml).toContain('justify-content: flex-start');

    const neutralHtml = postProcessRenderedHtml(parsed, theme.style);
    expect(neutralHtml).not.toContain('data-theme=');

    const explicitNeutralHtml = postProcessRenderedHtml(marked.parse('```mermaid {theme=neutral}\nflowchart LR\nA --> B\n```') as string, theme.style);
    expect(explicitNeutralHtml).toContain('data-theme="neutral"');

    const customHtml = postProcessRenderedHtml(parsed, theme.style, undefined, {
      theme: 'custom',
      customColors: { primaryColor: '#2563eb', primaryTextColor: '#ffffff', primaryBorderColor: '#1d4ed8', lineColor: '#64748b' },
    });
    expect(customHtml).toContain('data-theme="custom"');
    expect(customHtml).toContain('data-mermaid-custom-colors');
  });

  it('uses the global Mermaid theme for standard fences but lets explicit fences override it', () => {
    const markdown = '```mermaid\nflowchart LR\nA --> B\n```';
    const standardHtml = postProcessRenderedHtml(marked.parse(markdown) as string, theme.style, undefined, { theme: 'forest' });
    expect(standardHtml).toContain('data-theme="forest"');

    const explicitMarkdown = '```mermaid {theme=dark}\nflowchart LR\nA --> B\n```';
    const explicitHtml = postProcessRenderedHtml(marked.parse(explicitMarkdown) as string, theme.style, undefined, { theme: 'forest' });
    expect(explicitHtml).toContain('data-theme="dark"');
    expect(explicitHtml).not.toContain('data-theme="forest"');
  });

  it('applies custom heading typography and spacing', () => {
    const css = getMarkdownBodyCss('.body', {
      ...theme.style,
      headingFonts: {
        ...theme.style.headingFonts,
        h1: { fontFamily: 'Arial', fontSize: 31, bold: false, italic: true, underline: true, marginBefore: 41, marginAfter: 9 },
      },
    });

    expect(css).toContain('font-family: Arial');
    expect(css).toContain('font-size: 31px');
    expect(css).toContain('font-weight: 400');
    expect(css).toContain('font-style: italic');
    expect(css).toContain('text-decoration: underline');
    expect(css).toContain('margin-top: 41px');
    expect(css).toContain('margin-bottom: 9px');
  });

  it('applies custom body typography', () => {
    const css = getMarkdownBodyCss('.body', {
      ...theme.style,
      bodyFontFamily: 'Microsoft YaHei',
    });

    expect(css).toContain('.body { font-family: Microsoft YaHei; }');
  });

  it('centers display math regardless of the block-level svg imposed by Tailwind preflight', () => {
    const css = getMarkdownBodyCss('.body', theme.style);

    expect(css).toContain('.body .math-block { display: block; margin: 1.1em 0; text-align: center;');
    expect(css).toContain('.body .math-block mjx-container[jax="SVG"] > svg { display: block; margin-left: auto; margin-right: auto; }');
  });

  it('applies default and custom paragraph spacing to top-level paragraphs', () => {
    const defaultCss = getMarkdownBodyCss('.body', theme.style);
    const customCss = getMarkdownBodyCss('.body', {
      ...theme.style,
      paragraphMarginBefore: 8,
      paragraphMarginAfter: 12,
    });

    expect(defaultCss).toContain('.body > p { margin-top: 0px; margin-bottom: 6px;');
    expect(customCss).toContain('.body > p { margin-top: 8px; margin-bottom: 12px;');
  });

  it.each([
    ['striped', 'background: #f8fafc', 'background: var(--primary-color)', 'border: 1px solid #e2e8f0'],
    ['bordered', 'background: transparent', 'border: 1px solid var(--primary-color)', 'border: 1px solid #e2e8f0'],
    ['minimal', 'background: transparent', `border: none; border-bottom: 1px solid ${theme.style.primaryColor}`, 'border: none;'],
  ] as const)('applies the %s table style', (tableStyle, rowRule, headerRule, cellRule) => {
    const css = getMarkdownBodyCss('.body', { ...theme.style, tableStyle });

    expect(css).toContain(rowRule);
    expect(css).toContain(headerRule);
    expect(css).toContain(cellRule);
    if (tableStyle === 'minimal') {
      expect(css).toContain(`border-top: 1px solid ${theme.style.primaryColor}; border-bottom: 1px solid ${theme.style.primaryColor}`);
      expect(css).toContain('text-align: center');
      expect(css).toContain('font-weight: 400');
      expect(css).not.toContain('border-bottom: 1px solid #e2e8f0');
    }
  });

  it('wraps and numbers image captions with shared counters', () => {
    const counters = { imgCount: 0, tableCount: 0 };
    const first = postProcessRenderedHtml('<p><img src="a.png" alt="架构图"></p>', theme.style, counters);
    const second = postProcessRenderedHtml('<p><img src="b.png" alt="部署图"></p>', theme.style, counters);
    expect(first).toContain('图 1: 架构图');
    expect(second).toContain('图 2: 部署图');
    expect(counters.imgCount).toBe(2);
  });

  it('aligns the image block and its caption with imageConfig.captionAlign', () => {
    const markup = '<p><img src="a.png" alt="架构图"></p>';
    const render = (captionAlign: 'center' | 'left' | 'right') => postProcessRenderedHtml(markup, {
      ...theme.style,
      imageConfig: { ...theme.style.imageConfig!, captionAlign },
    });

    expect(render('left')).toContain('align-items: flex-start; text-align: left');
    expect(render('left')).toContain('class="doc-image-caption" style="text-align: left; width: 100%;"');
    expect(render('center')).toContain('align-items: center; text-align: center');
    expect(render('right')).toContain('align-items: flex-end; text-align: right');
  });

  it('aligns table captions with tableCaptionConfig.captionAlign', () => {
    const markup = '<p>表 1: 接口清单</p>\n<table><tr><td>a</td></tr></table>';
    const html = postProcessRenderedHtml(markup, {
      ...theme.style,
      tableCaptionConfig: { ...theme.style.tableCaptionConfig!, captionAlign: 'left' },
    });

    expect(html).toContain('class="doc-table-caption" style="text-align: left;"');
  });

  it('applies compact image dimensions and removes the attribute suffix', () => {
    const rawHtml = marked.parse('![架构图](a.png){w=320 h=180}') as string;
    const html = postProcessRenderedHtml(rawHtml, theme.style);

    expect(html).toContain('width: 320px');
    expect(html).toContain('height: 180px');
    expect(html).not.toContain('{w=320 h=180}');
  });
});