// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { BUILTIN_HTML_TEMPLATES, buildHtmlTemplateBlock, exportHtmlTemplates, importHtmlTemplates, loadHtmlTemplates, saveHtmlTemplates } from './htmlTemplateStore';

describe('HTML template library', () => {
  beforeEach(() => localStorage.clear());

  it('persists user templates and roundtrips exports without reusing IDs', () => {
    const template = { ...BUILTIN_HTML_TEMPLATES[0], id: 'user-one' };
    saveHtmlTemplates([template]);
    expect(loadHtmlTemplates()).toEqual([template]);
    const imported = importHtmlTemplates(exportHtmlTemplates([template]));
    expect(imported[0]).toMatchObject({ title: template.title, css: template.css, html: template.html });
    expect(imported[0].id).not.toBe(template.id);
  });

  it('rejects unsupported, incomplete and oversized imports', () => {
    expect(() => importHtmlTemplates('{')).toThrow();
    expect(() => importHtmlTemplates('{"templates":[]}')).toThrow();
    expect(() => importHtmlTemplates(JSON.stringify({ format: 'sdc-html-templates', version: 1, templates: [{ title: 'test' }] }))).toThrow();
    expect(() => importHtmlTemplates(' '.repeat(2_000_001))).toThrow();
  });

  it('wraps pure HTML and CSS without storing runtime scopes', () => {
    const block = buildHtmlTemplateBlock(BUILTIN_HTML_TEMPLATES[0]);
    expect(block).toContain('<section data-sdc-html>');
    expect(block).toContain('<style>');
    expect(block).not.toContain('data-sdc-scope');
    expect(() => buildHtmlTemplateBlock({ css: '</style>', html: '<p>test</p>' })).toThrow();
  });
});