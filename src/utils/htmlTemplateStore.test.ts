// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN_HTML_TEMPLATES, buildHtmlTemplateBlock, exportHtmlTemplates, importHtmlTemplates, loadHtmlTemplates, saveHtmlTemplates } from './htmlTemplateStore';
import { BUILTIN_HTML_TEMPLATES as catalogTemplates, parseHtmlTemplateSource } from '../data/htmlTemplates';
import { compileScopedCss } from './htmlBlocks';
import { buildAiTools } from './aiAssistantService';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';
import { getRegisteredThemes } from '../themes/themeRegistry';

function templateTool() {
  return buildAiTools({
    markdown: '',
    getMeta: () => DEFAULT_DOCUMENT_META,
    getTheme: () => getRegisteredThemes()[0],
    settings: { historyEnabled: true, historyIdleMinutes: 10 },
    onUpdateMeta: vi.fn(),
    onUpdateTheme: vi.fn(),
    onUpdateSettings: vi.fn(),
    onSetHistory: vi.fn(),
    onStartDiffReview: async session => ({ markdown: session.modifiedText, acceptedCount: 0, rejectedCount: 0, cancelled: false }),
    onCancelDiffReview: vi.fn(),
  }).find(tool => tool.definition.function.name === 'manage_html_templates')!;
}

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

  it('lists builtin and custom template metadata without source code through AI', async () => {
    saveHtmlTemplates([{ id: 'custom-one', title: 'Custom', description: 'Note', css: 'p{color:red}', html: '<p>Private source</p>' }]);
    const tool = templateTool();
    const properties = tool.definition.function.parameters.properties as Record<string, unknown>;
    expect(properties.action).toMatchObject({ enum: ['list', 'read', 'add', 'edit'] });
    const result = JSON.parse(await tool.handler({ action: 'list' }));
    expect(result.total).toBe(BUILTIN_HTML_TEMPLATES.length + 1);
    expect(result.templates).toContainEqual({ id: 'custom-one', title: 'Custom', description: 'Note', builtin: false, readOnly: false });
    expect(result.templates[0]).toMatchObject({ id: BUILTIN_HTML_TEMPLATES[0].id, builtin: true, readOnly: true });
    for (const template of result.templates) {
      expect(template).not.toHaveProperty('html');
      expect(template).not.toHaveProperty('css');
    }
    expect(JSON.stringify(result)).not.toContain('Private source');
  });

  it('reads complete builtin templates by ID through AI', async () => {
    const builtin = BUILTIN_HTML_TEMPLATES[0];
    const result = JSON.parse(await templateTool().handler({ action: 'read', id: builtin.id }));
    expect(result).toEqual({ ...builtin, builtin: true, readOnly: true });
  });

  it('adds and partially edits custom templates without changing their IDs or other fields', async () => {
    const tool = templateTool();
    const added = JSON.parse(await tool.handler({ action: 'add', title: ' New template ', html: '<div>\r\nText\r\n</div>' }));
    expect(added).toMatchObject({ action: 'add', success: true, title: 'New template', builtin: false, readOnly: false });
    expect(added.id).toEqual(expect.any(String));
    expect(BUILTIN_HTML_TEMPLATES.some(template => template.id === added.id)).toBe(false);
    expect(loadHtmlTemplates()).toEqual([{ id: added.id, title: 'New template', description: '', css: '', html: '<div>\nText\n</div>' }]);
    const edited = JSON.parse(await tool.handler({ action: 'edit', id: added.id, css: 'div { color: var(--text-muted); }', description: 'Updated note' }));
    expect(edited).toMatchObject({ action: 'edit', success: true, id: added.id });
    expect(JSON.parse(await tool.handler({ action: 'read', id: added.id }))).toEqual({
      id: added.id, title: 'New template', description: 'Updated note', css: 'div { color: var(--text-muted); }', html: '<div>\nText\n</div>', builtin: false, readOnly: false,
    });
    await tool.handler({ action: 'edit', id: added.id, css: '', description: '' });
    expect(loadHtmlTemplates()[0]).toMatchObject({ css: '', description: '', html: '<div>\nText\n</div>' });
    expect(loadHtmlTemplates()).toHaveLength(1);
  });

  it.each([
    {},
    { action: 'delete' },
    { action: 'read' },
    { action: 'read', id: 123 },
    { action: 'read', id: 'missing' },
    { action: 'edit' },
    { action: 'edit', id: 'missing', title: 'Updated' },
    { action: 'edit', id: BUILTIN_HTML_TEMPLATES[0].id, title: 'Changed builtin' },
    { action: 'add', html: '<p>Text</p>' },
    { action: 'add', title: 'Title' },
    { action: 'add', title: ' ', html: '<p>Text</p>' },
    { action: 'add', title: 'Title', html: ' ' },
    { action: 'add', title: 'Title', html: '<p>Text</p>', css: 123 },
    { action: 'add', title: 'Title', html: '<p>Text</p>', css: '</style>' },
    { action: 'add', title: 'Title', html: 'x'.repeat(200_001) },
  ])('rejects invalid or read-only AI template operations %# without writes', async args => {
    await expect(templateTool().handler(args)).rejects.toMatchObject({ kind: 'invalid_arguments' });
    expect(loadHtmlTemplates()).toEqual([]);
  });

  it('preserves saved templates when AI edits are invalid or omit changes', async () => {
    const original = { id: 'custom-one', title: 'Original', description: '', css: '', html: '<p>Original</p>' };
    saveHtmlTemplates([original]);
    const tool = templateTool();
    await expect(tool.handler({ action: 'edit', id: original.id })).rejects.toMatchObject({ kind: 'invalid_arguments' });
    await expect(tool.handler({ action: 'edit', id: original.id, html: '' })).rejects.toMatchObject({ kind: 'invalid_arguments' });
    expect(loadHtmlTemplates()).toEqual([original]);
  });

  it('reports persistence failures rather than returning success for AI additions', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
    try {
      await expect(templateTool().handler({ action: 'add', title: 'Title', html: '<p>Text</p>' })).rejects.toMatchObject({ kind: 'system_failure' });
    } finally {
      storage.mockRestore();
    }
    expect(loadHtmlTemplates()).toEqual([]);
  });
});