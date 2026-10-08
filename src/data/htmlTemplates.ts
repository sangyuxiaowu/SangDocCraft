import type { HtmlTemplate } from '../types/htmlTemplate';

export function parseHtmlTemplateSource(source: string, path = 'HTML template'): { order: number; template: HtmlTemplate } {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`Missing template front matter: ${path}`);
  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const field = line.match(/^(id|title|description|order):[ \t]*(.*)$/);
    if (!field || Object.hasOwn(fields, field[1])) throw new Error(`Invalid template metadata line: ${path}: ${line}`);
    let value = field[2].trim();
    if (value.startsWith('"')) {
      try { value = JSON.parse(value); }
      catch { throw new Error(`Invalid quoted metadata value: ${path}: ${line}`); }
    } else if (value.startsWith("'")) {
      if (!value.endsWith("'") || value.length < 2) throw new Error(`Invalid quoted metadata value: ${path}: ${line}`);
      value = value.slice(1, -1).replace(/''/g, "'");
    }
    fields[field[1]] = value;
  }
  const order = Number(fields.order);
  if (!fields.id?.trim() || !fields.title?.trim() || fields.description === undefined
    || !fields.order?.trim() || !Number.isFinite(order)) throw new Error(`Invalid template metadata: ${path}`);
  const body = match[2].trim();
  const style = body.match(/^<style\b[^>]*>([\s\S]*?)<\/style\s*>\s*/i);
  if (/^<style\b/i.test(body) && !style) throw new Error(`Unclosed template style: ${path}`);
  const css = style?.[1].trim() || '';
  const html = (style ? body.slice(style[0].length) : body).trim();
  if (!html) throw new Error(`Missing template HTML: ${path}`);
  return { order, template: { id: fields.id.trim(), title: fields.title.trim(), description: fields.description, css, html } };
}

const sources = import.meta.glob<string>('./htmlTemplates/**/*.md', { eager: true, query: '?raw', import: 'default' });
const ids = new Set<string>();

export const BUILTIN_HTML_TEMPLATES: HtmlTemplate[] = Object.entries(sources)
  .map(([path, source]) => {
    const entry = parseHtmlTemplateSource(source, path);
    if (ids.has(entry.template.id)) throw new Error(`Duplicate HTML template id: ${entry.template.id}`);
    ids.add(entry.template.id);
    return entry;
  })
  .sort((first, second) => first.order - second.order || first.template.id.localeCompare(second.template.id, 'en'))
  .map(entry => entry.template);