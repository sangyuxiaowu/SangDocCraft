import { describe, expect, it } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';
import { generateStandaloneHtml } from './htmlExporter';

describe('generateStandaloneHtml', () => {
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