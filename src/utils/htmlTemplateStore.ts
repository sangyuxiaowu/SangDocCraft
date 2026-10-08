import type { HtmlTemplate } from '../types/htmlTemplate';

export type { HtmlTemplate } from '../types/htmlTemplate';
export { BUILTIN_HTML_TEMPLATES } from '../data/htmlTemplates';

const STORAGE_KEY = 'sangdoccraft_html_templates_v1';

function validateTemplate(value: unknown): HtmlTemplate {
  if (!value || typeof value !== 'object') throw new Error('模板必须是对象。');
  const item = value as Record<string, unknown>;
  for (const key of ['title', 'description', 'css', 'html']) {
    if (typeof item[key] !== 'string' || (item[key] as string).length > 200_000) throw new Error(`模板字段 ${key} 无效或过长。`);
  }
  if (!(item.title as string).trim() || !(item.html as string).trim()) throw new Error('模板标题和 HTML 不能为空。');
  return {
    id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
    title: (item.title as string).trim(), description: item.description as string,
    css: item.css as string, html: item.html as string,
  };
}

export function loadHtmlTemplates(): HtmlTemplate[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const values: unknown = JSON.parse(raw);
  if (!Array.isArray(values)) throw new Error('本机模板库格式无效。');
  return values.map(validateTemplate);
}

export function saveHtmlTemplates(templates: HtmlTemplate[]): void {
  const validated = templates.map(validateTemplate);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
}

export function exportHtmlTemplates(templates: HtmlTemplate[]): string {
  return JSON.stringify({ format: 'sdc-html-templates', version: 1, templates: templates.map(validateTemplate) }, null, 2);
}

export function importHtmlTemplates(source: string): HtmlTemplate[] {
  if (source.length > 2_000_000) throw new Error('模板文件不能超过 2 MB。');
  const data = JSON.parse(source);
  if (data?.format !== 'sdc-html-templates' || data.version !== 1 || !Array.isArray(data.templates) || data.templates.length > 200) {
    throw new Error('不支持的模板文件格式或版本。');
  }
  return data.templates.map((value: unknown) => ({ ...validateTemplate(value), id: crypto.randomUUID() }));
}

export function buildHtmlTemplateBlock(template: Pick<HtmlTemplate, 'css' | 'html'>): string {
  const css = template.css.trim();
  if (/<\/style\s*>/i.test(css)) throw new Error('CSS 中不能包含 </style> 标签。');
  return `<section data-sdc-html>\n${css ? `  <style>\n${css}\n  </style>\n\n` : ''}${template.html.trim()}\n</section>`;
}