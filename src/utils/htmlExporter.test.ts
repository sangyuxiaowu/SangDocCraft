import { describe, expect, it } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';
import { generateStandaloneHtml } from './htmlExporter';

describe('generateStandaloneHtml', () => {
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

  it('exports manual table breaks with repeated headers and no implicit heading breaks', () => {
    const base = PRESET_THEMES[0];
    const html = generateStandaloneHtml(
      '# First\n\n# Second\n\n| ID | Value |\n| --- | --- |\n| 1 | first |\n<!-- pagebreak -->\n| 2 | second |',
      { ...base, meta: { ...base.meta, showCover: false }, toc: { ...base.toc, show: false }, style: { ...base.style, paginationMode: 'manual', h1PageBreak: true } },
    );
    expect(html.match(/class="a4-page content-page-wrapper"/g)).toHaveLength(2);
    expect(html.match(/<th>ID<\/th>/g)).toHaveLength(2);
    expect(html).toContain('<td>second</td>');
    expect(html).not.toContain('<!-- pagebreak -->');
  });

  it('creates a standalone document with frontmatter metadata and TOC anchors', () => {
    const html = generateStandaloneHtml(
      '---\ntitle: Export title\n---\n# First\n\nBody\n\n## Second',
      PRESET_THEMES[0],
    );

    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('<title>Export title</title>');
    expect(html).toContain('id="heading-1"');
    expect(html).toContain('First');
    expect(html).toContain('Second');
  });

  it('preserves Mermaid as a renderable container before async export finalization', () => {
    const html = generateStandaloneHtml(
      '```mermaid\nflowchart LR\nA --> B\n```',
      { ...PRESET_THEMES[0], meta: { ...PRESET_THEMES[0].meta, showCover: false }, toc: { ...PRESET_THEMES[0].toc, show: false } },
    );

    expect(html).toContain('class="mermaid"');
    expect(html).not.toContain('language-mermaid');
  });
});