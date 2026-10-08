export interface HtmlTemplate {
  id: string;
  title: string;
  description: string;
  css: string;
  html: string;
}

const STORAGE_KEY = 'sangdoccraft_html_templates_v1';
export const BUILTIN_HTML_TEMPLATES: HtmlTemplate[] = [
  {
    id: 'builtin-project', title: '项目说明', description: '标题与正文组成的项目说明块。',
    css: '.title { color: #c62828; margin: 0 0 12px; }\np { margin: 0; line-height: 1.7; }\n.note { border-left: 3px solid #c62828; padding: 12px 16px; background: #fff5f5; }',
    html: '<div class="note">\n  <h3 class="title">项目说明</h3>\n  <p>这里使用纯 HTML，不混写 Markdown。</p>\n</div>',
  },
  {
    id: 'builtin-metrics', title: '关键指标', description: '三列排布的交付指标。',
    css: '.metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; border-top: 2px solid #167d65; padding: 16px 0; }\n.metric { border-right: 1px solid #ddd; padding-right: 12px; }\nstrong { display: block; font-size: 26px; color: #167d65; }\np { margin: 4px 0 0; font-size: 13px; }',
    html: '<div class="metrics">\n  <div class="metric"><strong>98%</strong><p>完成率</p></div>\n  <div class="metric"><strong>12</strong><p>交付成果</p></div>\n  <div class="metric"><strong>30 天</strong><p>实施周期</p></div>\n</div>',
  },
  {
    id: 'builtin-signature', title: '签字确认', description: '交付文档的签字与日期栏。',
    css: '.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; padding: 24px 0; }\nh4 { margin: 0 0 20px; }\np { margin: 12px 0; }\n.line { display: inline-block; width: 120px; border-bottom: 1px solid #555; }',
    html: '<div class="signatures">\n  <div><h4>甲方确认</h4><p>签字：<span class="line">&nbsp;</span></p><p>日期：<span class="line">&nbsp;</span></p></div>\n  <div><h4>乙方确认</h4><p>签字：<span class="line">&nbsp;</span></p><p>日期：<span class="line">&nbsp;</span></p></div>\n</div>',
  },
];

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