import { describe, expect, it } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';
import {
  formatPageNumber,
  getEffectiveMeta,
  getFooterSlots,
  getHeadingText,
  getMarkdownBodyCss,
  getTocChunks,
  parseFrontmatter,
  parseTableOfContents,
  postProcessRenderedHtml,
  splitContentByPages,
  updateMarkdownFrontmatter,
} from './markdownParser';

const theme = PRESET_THEMES[0];

describe('Markdown frontmatter', () => {
  it('parses metadata and normalizes cover list values', () => {
    const markdown = `---
title: API 设计
date: 2026-08-15
coverStyle: enterprise
coverlist:
  - 环境: 生产
  - label: 版本
    value: v2
---
# 正文`;

    const parsed = parseFrontmatter(markdown);

    expect(parsed.body).toBe('# 正文');
    expect(parsed.extractedMeta).toMatchObject({
      title: 'API 设计',
      date: '2026-08-15',
      coverStyle: 'enterprise',
      coverlist: [
        { label: '环境', value: '生产' },
        { label: '版本', value: 'v2' },
      ],
    });
  });

  it('ignores invalid YAML and unknown cover templates', () => {
    expect(parseFrontmatter('---\ntitle: [\n---\nbody').frontmatter).toBeNull();
    expect(parseFrontmatter('---\ncoverStyle: missing\n---\nbody').extractedMeta?.coverStyle).toBeUndefined();
  });

  it('round-trips metadata while preserving custom fields', () => {
    const source = '---\ncustom: retained\ntitle: old\n---\n\nBody';
    const nextMeta = {
      ...theme.meta,
      title: 'New title',
      logo: 'assets/logo.png',
      coverlist: [{ label: '版本', value: 'v3' }],
    };

    const updated = updateMarkdownFrontmatter(source, nextMeta);
    const parsed = parseFrontmatter(updated);

    expect(parsed.frontmatter).toMatchObject({ custom: 'retained', title: 'New title', logo: 'assets/logo.png' });
    expect(parsed.extractedMeta?.coverlist).toEqual([{ label: '版本', value: 'v3' }]);
    expect(parsed.body.trim()).toBe('Body');
  });

  it('lets frontmatter override only fields it defines', () => {
    const effective = getEffectiveMeta(theme.meta, '---\ntitle: Override\n---\nBody');
    expect(effective.title).toBe('Override');
    expect(effective.organization).toBe(theme.meta.organization);
  });
});

describe('Markdown pagination and numbering', () => {
  it('splits explicit page breaks without losing content', () => {
    const pages = splitContentByPages('First\n\n<!-- pagebreak -->\n\nSecond');
    expect(pages).toHaveLength(2);
    expect(pages.join('\n')).toContain('First');
    expect(pages.join('\n')).toContain('Second');
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
    const slots = getFooterSlots(2, 5, { ...theme.footer, pageNumberPosition: 'center' }, theme.meta);
    expect(slots.center).toBe('第 2 页 / 共 5 页');
    expect(slots.left).toBe(theme.footer.leftText || theme.meta.organization);
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

  it('wraps and numbers image captions with shared counters', () => {
    const counters = { imgCount: 0, tableCount: 0 };
    const first = postProcessRenderedHtml('<p><img src="a.png" alt="架构图"></p>', theme.style, counters);
    const second = postProcessRenderedHtml('<p><img src="b.png" alt="部署图"></p>', theme.style, counters);
    expect(first).toContain('图 1: 架构图');
    expect(second).toContain('图 2: 部署图');
    expect(counters.imgCount).toBe(2);
  });
});