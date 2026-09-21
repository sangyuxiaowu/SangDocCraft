// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';
import { generateStandaloneHtml } from './htmlExporter';
import { containsMath, ensureMathLoaded } from './mathRenderer';

describe('generateStandaloneHtml', () => {
  it('embeds rendered LaTeX formulas as self-contained SVG', async () => {
    await ensureMathLoaded();
    expect(containsMath('公式 $E = mc^2$ 与 $\\alpha$')).toBe(true);

    const html = generateStandaloneHtml('打分公式 $S(q, d)$ 如下：\n\n$$\nE = mc^2\n$$', PRESET_THEMES[0]);
    expect(html).toContain('<mjx-container');
    expect(html).toContain('class="math-block"');
    // 公式字形内嵌在 SVG 中，导出文件不依赖外部字体或脚本
    expect(html).not.toContain('MathJax.js');
  });

  it.each(['signature', 'briefing'])('keeps body heading borders off the %s cover title', (coverStyle) => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml('# Body', { ...base, cover: { ...base.cover, coverStyle } });
    document.documentElement.innerHTML = html;
    const coverTitle = document.querySelector('.cover-page h1')!;
    const bodyTitle = document.querySelector('.markdown-content h1')!;
    const headingRule = Array.from(document.styleSheets[0].cssRules).find((rule) =>
      'selectorText' in rule && rule.cssText.includes('border-bottom: 2px solid var(--accent-color)') && rule.cssText.includes('padding-bottom: 6px'),
    ) as CSSStyleRule;
    expect(headingRule).toBeDefined();
    expect(coverTitle.matches(headingRule.selectorText)).toBe(false);
    expect(bodyTitle.matches(headingRule.selectorText)).toBe(true);
    expect(window.getComputedStyle(coverTitle).paddingBottom).not.toBe('6px');
    document.documentElement.innerHTML = '';
  });

  it.each(['enterprise', 'academic', 'signature', 'briefing'])('exports theme metadata columns for %s', (coverStyle) => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml(
      '# Body',
      {
        ...base,
        cover: {
          ...base.cover,
          coverStyle,
          coverListColumns: 2,
          coverlist: [
            { label: 'Author', value: 'Alice' },
            { label: 'Date', value: '' },
            { label: 'Reviewer', value: 'Bob' },
          ],
        },
      },
    );
    expect(html).toContain(`cover-style-${coverStyle}`);
    expect(html).toContain('data-cover-columns="2"');
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
  });

  it('exports minimal tables with a borderless regular-weight header', () => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml(
      '| 因素 | 水平 1 | 水平 2 |\n| --- | --- | --- |\n| 电压 | 1050 | 900 |',
      {
        ...base,
        cover: { ...base.cover, showCover: false },
        toc: { ...base.toc, show: false },
        style: { ...base.style, tableStyle: 'minimal' },
      },
    );
    const tableRules = html.match(/\.markdown-content table\s*\{[^}]*\}/g) || [];
    const headerRules = html.match(/\.markdown-content th\s*\{[^}]*\}/g) || [];
    const cellRules = html.match(/\.markdown-content td\s*\{[^}]*\}/g) || [];
    const tableRule = tableRules.at(-1)!;
    const headerRule = headerRules.at(-1)!;
    const cellRule = cellRules.at(-1)!;

    expect(tableRule).toContain(`border-top: 1px solid ${base.style.primaryColor}`);
    expect(tableRule).toContain(`border-bottom: 1px solid ${base.style.primaryColor}`);
    expect(headerRule).toContain('border: none');
    expect(headerRule).toContain(`border-bottom: 1px solid ${base.style.primaryColor}`);
    expect(headerRule.indexOf('border: none')).toBeLessThan(headerRule.indexOf('border-bottom'));
    expect(headerRule).toContain('font-weight: 400');
    expect(cellRule).toContain('border: none');
  });

  it.each([
    ['underline', 'border-bottom: 2px solid'],
    ['accent-block', 'border-left: 5px solid'],
    ['badge', 'padding: 6px 12px'],
    ['minimal', 'padding: 0;'],
  ] as const)('applies the %s TOC title style', (titleStyle, expected) => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml('# First\n\nBody', { ...base, toc: { ...base.toc, show: true, titleStyle } });
    const rules = html.match(/\.toc-title \{[^}]*\}/g) || [];
    expect(rules.join('\n')).toContain(expected);
    expect(html).toContain('class="toc-title"');
    expect(html).toContain('id="heading-1"');
  });

  it.each([
    ['solid', '1px solid #cbd5e1'],
    ['accent', `2px solid ${PRESET_THEMES[0].style.accentColor}`],
    ['double', `3px double ${PRESET_THEMES[0].style.accentColor}`],
    ['none', 'none'],
  ] as const)('exports the %s header divider independently from ordinary accent usage', (lineStyle, expected) => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml('# Body', {
      ...base,
      header: { ...base.header, lineStyle },
    });
    const headerRule = html.match(/\.doc-header \{[^}]*\}/)?.[0] || '';

    expect(headerRule).toContain(`border-bottom: ${expected}`);
  });

  it('exports manual table breaks with repeated headers and no implicit heading breaks', () => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml(
      '# First\n\n# Second\n\n| ID | Value |\n| --- | --- |\n| 1 | first |\n<!-- pagebreak -->\n| 2 | second |',
      { ...base, cover: { ...base.cover, showCover: false }, toc: { ...base.toc, show: false }, style: { ...base.style, paginationMode: 'manual', h1PageBreak: true } },
    );
    expect(html.match(/class="a4-page content-page-wrapper"/g)).toHaveLength(2);
    expect(html.match(/<th>ID<\/th>/g)).toHaveLength(2);
    expect(html).toContain('<td>second</td>');
    expect(html).not.toContain('<!-- pagebreak -->');
  });

  it('keeps exported content pages constrained to a single A4 sheet', () => {
    const html = generateStandaloneHtml('# Body', {
      ...PRESET_THEMES[0],
      cover: { ...PRESET_THEMES[0].cover, showCover: false },
      toc: { ...PRESET_THEMES[0].toc, show: false },
    });

    expect(html).not.toContain('.a4-page.content-page-wrapper {');
    expect(html).toContain('height: 297mm;');
    expect(html).toContain('overflow: hidden;');
  });

  it('exports tiled watermarks with numeric text coordinates and one image resource', () => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml('# First\n\n<!-- pagebreak -->\n\n# Second', {
      ...base,
      cover: { ...base.cover, showCover: false },
      toc: { ...base.toc, show: false },
      style: {
        ...base.style,
        paginationMode: 'manual',
        watermark: {
          show: true,
          type: 'image',
          text: '',
          fontSize: 28,
          color: '#94a3b8',
          opacity: 0.15,
          rotate: -30,
          layout: 'repeat',
          repeatGap: 140,
          hideOnCover: true,
          imageUrl: 'https://example.com/watermark.png',
          imageWidth: 120,
        },
      },
    });

    expect(html.match(/href="https:\/\/example\.com\/watermark\.png"/g)).toHaveLength(1);
    expect(html.match(/<use\s+href="#doc-watermark-image"/g)).toHaveLength(2);

    const textHtml = generateStandaloneHtml('# Body', {
      ...base,
      cover: { ...base.cover, showCover: false },
      toc: { ...base.toc, show: false },
      style: { ...base.style, watermark: { ...base.style.watermark, show: true, layout: 'repeat', type: 'text' } },
    });
    expect(textHtml).toMatch(/<text\s+x="\d+(?:\.\d+)?"\s+y="\d+(?:\.\d+)?"/);
    expect(textHtml).not.toContain('x="50%"');
  });

  it('does not treat YAML-like document prefixes as metadata', () => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml(
      '---\ntitle: Export title\n---\n# First\n\nBody\n\n## Second',
      base,
    );

    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain(`<title>${base.meta.title}</title>`);
    expect(html).toContain('title: Export title');
    expect(html).toContain('id="heading-1"');
    expect(html).toContain('First');
    expect(html).toContain('Second');
  });

  it('preserves Mermaid as a renderable container before async export finalization', () => {
    const html = generateStandaloneHtml(
      '```mermaid\nflowchart LR\nA --> B\n```',
      { ...PRESET_THEMES[0], cover: { ...PRESET_THEMES[0].cover, showCover: false }, toc: { ...PRESET_THEMES[0].toc, show: false } },
    );

    expect(html).toContain('class="mermaid"');
    expect(html).not.toContain('language-mermaid');
  });

  it('repaginates the export with the measured Mermaid height', () => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      const listHeight = this.querySelectorAll('li').length * 180;
      const headingHeight = this.querySelectorAll('h2').length * 24;
      const mermaid = this.querySelector<HTMLElement>('.mermaid');
      return listHeight + headingHeight + (mermaid ? Number.parseFloat(mermaid.style.height) || 180 : 0);
    });
    const source = '- One\n- Two\n- Three\n\n## Diagram\n\n```mermaid\nflowchart LR\nA --> B\n```';
    const theme = {
      ...PRESET_THEMES[0],
      meta: { ...PRESET_THEMES[0].meta, showCover: false },
      toc: { ...PRESET_THEMES[0].toc, show: false },
    };

    try {
      expect(generateStandaloneHtml(source, theme).match(/class="a4-page content-page-wrapper"/g)).toHaveLength(1);
      expect(generateStandaloneHtml(source, theme, { 'flowchart LR\nA --> B': 500 }).match(/class="a4-page content-page-wrapper"/g)).toHaveLength(2);
    } finally {
      height.mockRestore();
    }
  });
});