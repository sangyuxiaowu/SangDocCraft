// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';
import type { DocumentTheme } from '../types';
import { generateStandaloneHtml as generateHtml } from './htmlExporter';
import { containsMath, ensureMathLoaded } from './mathRenderer';

const documentMeta = { ...DEFAULT_DOCUMENT_META, title: '测试交付文档' };
const generateStandaloneHtml = (
  markdown: string,
  theme: DocumentTheme,
  mermaidHeights: Record<string, number> = {},
) => generateHtml(markdown, documentMeta, theme, mermaidHeights);

describe('generateStandaloneHtml', () => {
  it('exports split paragraphs as unindented continuations without changing subsequent paragraphs', () => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return Array.from(this.querySelectorAll('p')).reduce((total, paragraph) =>
        total + (paragraph.textContent?.length ?? 0) + (paragraph.classList.contains('p-continuation') ? 0 : 24), 0);
    });
    try {
      const base = PRESET_THEMES[0];
      const source = 'word'.repeat(750);
      const html = generateStandaloneHtml(`${source}\n\nNew paragraph`, {
        ...base, cover: { ...base.cover, showCover: false }, toc: { ...base.toc, show: false },
        style: { ...base.style, indentParagraph: true },
      });
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const paragraphs = Array.from(parsed.querySelectorAll('.markdown-content > p'));
      expect(paragraphs.length).toBeGreaterThan(2);
      expect(paragraphs[0].classList.contains('p-continuation')).toBe(false);
      expect(paragraphs.slice(1, -1).every(paragraph => paragraph.classList.contains('p-continuation'))).toBe(true);
      expect(paragraphs.at(-1)?.classList.contains('p-continuation')).toBe(false);
      expect(paragraphs.map(paragraph => paragraph.textContent).join('')).toBe(`${source}New paragraph`);
    } finally {
      height.mockRestore();
    }
  });

  it('uses the muted text color for both headers and footers', () => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml('# Content', {
      ...base,
      style: { ...base.style, textSecondaryColor: '#112233', textMutedColor: '#aabbcc' },
    });

    expect(html).toContain('--text-muted:#aabbcc;');
    for (const selector of ['doc-header', 'doc-footer']) {
      const rule = html.match(new RegExp(`\\.${selector} \\{[^}]*\\}`))?.[0];
      expect(rule).toContain('color: var(--text-muted)');
      expect(rule).not.toContain('color: var(--text-secondary)');
    }
  });

  it('exports all four document color variables including a default image border', () => {
    const base = PRESET_THEMES[0];
    const colors = { primaryColor: '#112233', accentColor: '#445566', textColor: '#778899', imageConfig: { ...base.style.imageConfig, borderColor: '#aabbcc' } };
    const source = '<section data-sdc-html>\n<style>p{color:var(--text-color);border:1px solid var(--img-border-color)}</style>\n<p>Text</p>\n</section>';
    const html = generateStandaloneHtml(source, { ...base, style: { ...base.style, ...colors } });
    for (const [property, value] of [['primary', '#112233'], ['accent', '#445566'], ['text', '#778899'], ['img-border', '#aabbcc']]) {
      expect(html).toContain(`--${property}-color:${value};`);
    }
    expect(html).toContain('var(--text-color)');
    expect(html).toContain('var(--img-border-color)');
    const defaultHtml = generateStandaloneHtml(source, { ...base, style: { ...base.style, imageConfig: undefined } });
    expect(defaultHtml).toContain('--img-border-color:#cbd5e1;');
  });

  it('excludes pure HTML headings from document numbering and TOC anchors', () => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml('# Before\n\n<section data-sdc-html>\n<h1>Template heading</h1>\n</section>\n\n# After', {
      ...base, cover: { ...base.cover, showCover: false }, toc: { ...base.toc, show: true, headingNumbering: 'decimal' },
    });
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const templateHeading = parsed.querySelector('section h1')!;
    expect(templateHeading.textContent).toBe('Template heading');
    expect(templateHeading.hasAttribute('id')).toBe(false);
    expect(parsed.querySelector('#heading-2')?.textContent).toContain('After');
    expect(parsed.querySelector('#heading-3')).toBeNull();
  });

  it('exports unique scoped HTML blocks without scripts, animation or outside CSS', () => {
    const base = PRESET_THEMES[0];
    const block = '<section data-sdc-html>\n<style>.title{color:#c62828} p{margin:0;animation:spin 1s}</style>\n\n<h3 class="title">项目说明</h3><p onclick="alert(1)">正文</p><script>alert(1)</script>\n</section>';
    const html = generateStandaloneHtml(`<style>body{background:red}</style>\n\n${block}\n\n${block}`, {
      ...base, cover: { ...base.cover, showCover: false }, toc: { ...base.toc, show: false },
    });
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const sections = Array.from(parsed.querySelectorAll('section[data-sdc-html]'));
    expect(sections).toHaveLength(2);
    expect(new Set(sections.map(section => section.getAttribute('data-sdc-scope'))).size).toBe(2);
    expect(sections[0].querySelector('style')?.textContent).toContain('.title {color:#c62828}');
    expect(html).not.toMatch(/body\{background:red\}|onclick=|alert\(1\)|animation:spin/);
  });

  it('uses custom four-sided page margins in screen and print styles', () => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml('# Content', {
      ...base,
      cover: { ...base.cover, showCover: false },
      toc: { ...base.toc, show: false },
      pageLayout: { margins: { top: 12, right: 13, bottom: 14, left: 16 }, showSafeMarginGuides: true },
    });

    expect(html).toContain('padding: 12mm 13mm 14mm 16mm;');
    expect(html).toContain('padding: 12mm 13mm 14mm 16mm !important;');
  });

  it('exports infographic containers and shares figure numbering with images and Mermaid', () => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml(
      '![First](a.png)\n\n<!-- caption: Growth -->\n\n```infographic\ninfographic list-row-horizontal-icon-arrow\ndata\n  title Growth\n```\n\n<!-- caption: Flow -->\n\n```mermaid\nflowchart LR\nA --> B\n```',
      { ...base, cover: { ...base.cover, showCover: false }, toc: { ...base.toc, show: false } },
    );
    expect(html).toMatch(/图 1: First[\s\S]*doc-infographic-figure[\s\S]*图 2: Growth[\s\S]*doc-mermaid-figure[\s\S]*图 3: Flow/);
    expect(html).toMatch(/<div class="infographic"[^>]*>/);
    expect(html).not.toContain('<!-- caption:');
  });

  it('exports infographic dimensions and alignment without changing the caption alignment', () => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml(
      '<!-- caption: Growth -->\n\n```infographic {w=320 h=120 align=right}\ninfographic list-row-horizontal-icon-arrow\ndata\n  title Growth\n```',
      { ...base, cover: { ...base.cover, showCover: false }, toc: { ...base.toc, show: false } },
    );
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const diagram = parsed.querySelector<HTMLElement>('.infographic')!;
    expect(diagram.dataset).toMatchObject({ width: '320', height: '120', align: 'right' });
    expect(diagram.style.width).toBe('320px');
    expect(diagram.style.height).toBe('120px');
    expect(diagram.style.marginLeft).toBe('auto');
    expect(diagram.style.marginRight).toBe('0px');
    expect(parsed.querySelector<HTMLElement>('figcaption')?.style.textAlign).toBe('center');
    expect(diagram.textContent).not.toContain('{w=');
  });

  it('keeps an explicitly empty right header blank on every page', () => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml('# Body', {
      ...base,
      header: { ...base.header, show: true, hideOnCover: false, rightText: '' },
    });
    document.documentElement.innerHTML = html;
    expect(Array.from(document.querySelectorAll('.doc-header')).map((header) => header.lastElementChild?.textContent))
      .toEqual(['', '', '']);
    document.documentElement.innerHTML = '';
  });

  it.each(['minimal-header', 'minimal-logo'])('renders %s inside the first content page instead of a standalone page', (coverStyle) => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml('# 正文标题\n\n正文内容', {
      ...base,
      cover: { ...base.cover, coverStyle, showCover: true, logoUrl: 'brand.png' },
      toc: { ...base.toc, show: false },
    });
    document.documentElement.innerHTML = html;
    expect(document.querySelector('.cover-page-wrapper')).toBeNull();
    const firstContentPage = document.querySelector('.content-page-wrapper')!;
    expect(firstContentPage.querySelector(`[data-cover-template="${coverStyle}"]`)).not.toBeNull();
    expect(firstContentPage.textContent?.indexOf('季度经营报告')).toBeLessThan(firstContentPage.textContent?.indexOf('正文标题') ?? -1);
    document.documentElement.innerHTML = '';
  });

  it.each(['minimal-header', 'minimal-logo'])('disables TOC and hides the first-page header for %s', (coverStyle) => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml('# 第一页\n\n正文\n\n<!-- pagebreak -->\n\n# 第二页\n\n续文', {
      ...base,
      cover: { ...base.cover, coverStyle, showCover: true },
      toc: { ...base.toc, show: true, title: '不应生成的目录' },
      header: { ...base.header, show: true, hideOnCover: true, leftText: '页眉标记' },
    });
    document.documentElement.innerHTML = html;
    const pages = Array.from(document.querySelectorAll('.content-page-wrapper'));
    expect(document.querySelector('.toc-page-wrapper')).toBeNull();
    expect(document.body.textContent).not.toContain('不应生成的目录');
    expect(pages).toHaveLength(2);
    expect(pages[0].querySelector('.doc-header')).toBeNull();
    expect(pages[1].querySelector('.doc-header')?.textContent).toContain('页眉标记');
    document.documentElement.innerHTML = '';
  });

  it('resolves exact references per page including TOC and empty chapter fallbacks', () => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml('# 第一章\n\n正文\n\n<!-- pagebreak -->\n\n续页\n\n<!-- pagebreak -->\n\n## 第二节', {
      ...base,
      cover: { ...base.cover, coverlist: [{ label: '编号', value: '@number' }] },
      toc: { ...base.toc, show: true, title: '章节目录' },
      header: { ...base.header, show: true, hideOnCover: false, leftText: '@h1', centerText: '@title', rightText: '@h2' },
      footer: { ...base.footer, show: true, hideOnCover: false, leftText: '@h2', centerText: '@title', rightText: '前缀@title', pageNumberFormat: 'none' },
    });
    document.documentElement.innerHTML = html;
    expect(document.querySelector('.cover-page-wrapper .doc-header')?.textContent).not.toContain('@h1');
    expect(document.querySelector('.toc-page-wrapper .doc-header')?.textContent).toContain('章节目录');
    const pages = Array.from(document.querySelectorAll('.content-page-wrapper'));
    expect(pages).toHaveLength(3);
    expect(pages[0].querySelector('.doc-header')?.textContent).toContain('第一章');
    expect(pages[1].querySelector('.doc-footer')?.textContent).toContain('第一章');
    expect(pages[2].querySelector('.doc-footer')?.textContent).toContain('第二节');
    expect(pages[2].querySelector('.footer-right')?.textContent).toBe('前缀@title');
    expect(pages[2].querySelector('.doc-header-center')?.textContent).toBe(documentMeta.title);
    document.documentElement.innerHTML = '';
  });

  it('adds a non-printing attribution after all document pages', () => {
    const html = generateStandaloneHtml('# Body', PRESET_THEMES[0]);
    document.documentElement.innerHTML = html;

    const attribution = document.querySelector('.export-attribution')!;
    expect(document.body.lastElementChild).toBe(attribution);
    expect(attribution.textContent).toContain('SangDocCraft');
    expect(attribution.textContent).toMatch(/工具版本：v\d/);
    expect(attribution.querySelector('a')?.href).toBe('https://github.com/sangyuxiaowu/SangDocCraft?wt.mc_id=DT-MVP-5005195');
    expect(html).toContain('.export-attribution {\n        display: none !important;');
    document.documentElement.innerHTML = '';
  });

  it('embeds rendered LaTeX formulas as self-contained SVG', async () => {
    await ensureMathLoaded();
    expect(containsMath('公式 $E = mc^2$ 与 $\\alpha$')).toBe(true);

    const html = generateStandaloneHtml('打分公式 $S(q, d)$ 如下：\n\n$$\nE = mc^2\n$$', PRESET_THEMES[0]);
    expect(html).toContain('<mjx-container');
    expect(html).toContain('class="math-block"');
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const formulas = Array.from(parsed.querySelectorAll('mjx-container'));
    expect(formulas).toHaveLength(2);
    formulas.forEach(formula => {
      const references = Array.from(formula.querySelectorAll('use'));
      const paths = Array.from(formula.querySelectorAll('path[id]'));
      expect(references.length).toBeGreaterThan(0);
      references.forEach(element => {
        const reference = element.getAttribute('href') || element.getAttribute('xlink:href');
        expect(paths.some(path => `#${path.id}` === reference)).toBe(true);
      });
    });
    // 公式字形内嵌在 SVG 中，导出文件不依赖外部字体或脚本
    expect(html).not.toContain('MathJax.js');
  });

  it.each(['light', 'dark'] as const)('embeds %s syntax colors without runtime assets', (codeTheme) => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml('```sql\nSELECT name FROM users WHERE id = 1;\n```', {
      ...base,
      style: { ...base.style, codeTheme },
      cover: { ...base.cover, showCover: false },
      toc: { ...base.toc, show: false },
    });

    expect(html).toContain('<span class="hljs-keyword">SELECT</span>');
    expect(html).toContain(`--code-keyword: ${codeTheme === 'light' ? '#a21caf' : '#f0abfc'}`);
    expect(html).toContain('.markdown-content pre .hljs-keyword');
    expect(html).not.toMatch(/<script\b|<link\b|@import\b/i);
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

  it('exports Mermaid captions as figures with image numbering', () => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml(
      '![第一张](a.png)\n\n<!-- caption: 数据处理结构 -->\n\n```mermaid\nflowchart LR\nA --> B\n```',
      { ...base, cover: { ...base.cover, showCover: false }, toc: { ...base.toc, show: false } },
    );
    expect(html).toMatch(/图 1: 第一张[\s\S]*<figure class="doc-mermaid-figure">[\s\S]*图 2: 数据处理结构/);
    expect(html).not.toContain('<!-- caption: 数据处理结构 -->');
  });

    it('exports image alignment without changing caption alignment', () => {
      const base = PRESET_THEMES[0];
      const html = generateStandaloneHtml('![架构图](a.png){w=320 align=right}', {
        ...base,
        cover: { ...base.cover, showCover: false },
        toc: { ...base.toc, show: false },
      });
      expect(html).toContain('align-items: flex-end; text-align: center');
      expect(html).toContain('width: 320px; height: auto; margin-left: 0; margin-right: 0;');
      expect(html).not.toContain('{w=320 align=right}');
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
    expect(html).toContain(`<title>${documentMeta.title}</title>`);
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