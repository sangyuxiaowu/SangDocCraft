// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { BUILTIN_HTML_TEMPLATES, buildHtmlTemplateBlock, exportHtmlTemplates, importHtmlTemplates, loadHtmlTemplates, saveHtmlTemplates } from './htmlTemplateStore';
import { BUILTIN_HTML_TEMPLATES as catalogTemplates, parseHtmlTemplateSource } from '../data/htmlTemplates';
import { compileScopedCss } from './htmlBlocks';

describe('HTML template library', () => {
  beforeEach(() => localStorage.clear());

  it('discovers builtin Markdown templates in the existing order and preserves the public export', () => {
    expect(BUILTIN_HTML_TEMPLATES).toBe(catalogTemplates);
    const existingIds = ['builtin-project', 'builtin-metrics', 'builtin-signature'];
    expect(BUILTIN_HTML_TEMPLATES.map(template => template.id).filter(id => existingIds.includes(id))).toEqual(existingIds);
    expect(new Set(BUILTIN_HTML_TEMPLATES.map(template => template.id)).size).toBe(BUILTIN_HTML_TEMPLATES.length);
    for (const template of BUILTIN_HTML_TEMPLATES) {
      expect(template.title.trim()).not.toBe('');
      expect(template.description.trim()).not.toBe('');
      expect(template.html.trim()).not.toBe('');
      expect(template.css).not.toContain('\r');
      expect(template.html).not.toContain('\r');
      expect(compileScopedCss(template.css, 'sdc-test')).not.toBe('');
      expect(buildHtmlTemplateBlock(template)).toContain(template.html);
    }
  });

  it('parses simple front matter and separates the leading style from HTML', () => {
    const source = '\uFEFF---\r\nid: test\r\ntitle: "Title: #1"\r\ndescription: \'Owner\'\'s note\'\r\norder: 20\r\n---\r\n<style>\r\np { color: red; }\r\n</style>\r\n<div>**pure HTML**</div>';
    expect(parseHtmlTemplateSource(source)).toEqual({
      order: 20,
      template: { id: 'test', title: 'Title: #1', description: "Owner's note", css: 'p { color: red; }', html: '<div>**pure HTML**</div>' },
    });
  });

  it('allows HTML-only templates and rejects malformed or unsupported metadata', () => {
    const header = '---\nid: test\ntitle: Plain\ndescription: ""\norder: 10\n---\n';
    expect(parseHtmlTemplateSource(`${header}<p>Text</p>`).template.css).toBe('');
    expect(() => parseHtmlTemplateSource('<p>Missing header</p>')).toThrow();
    expect(() => parseHtmlTemplateSource(header.replace('order: 10', 'order: bad') + '<p>Text</p>')).toThrow();
    expect(() => parseHtmlTemplateSource(header.replace('title: Plain', 'title: Plain\ntitle: Duplicate') + '<p>Text</p>')).toThrow();
    expect(() => parseHtmlTemplateSource(header.replace('title: Plain', 'title: "Unclosed') + '<p>Text</p>')).toThrow();
    expect(() => parseHtmlTemplateSource(`${header}<style>p {color:red}`)).toThrow();
    expect(() => parseHtmlTemplateSource(`${header}<style>p {color:red}</style>`)).toThrow();
  });

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