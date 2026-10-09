import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart2,
  Check,
  CheckCircle2,
  CheckSquare,
  Code2,
  Columns,
  Copy,
  Download,
  Eye,
  FileCode,
  FileCode2,
  GitCommit,
  HelpCircle,
  Layers,
  LayoutGrid,
  Lock,
  Palette,
  PenLine,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { BUILTIN_HTML_TEMPLATES } from '../data/htmlTemplates';
import type { HtmlTemplate } from '../types/htmlTemplate';
import {
  buildHtmlTemplateBlock,
  exportHtmlTemplates,
  importHtmlTemplates,
  loadHtmlTemplates,
  saveHtmlTemplates,
} from '../utils/htmlTemplateStore';
import { sanitizeDocumentHtml } from '../utils/htmlBlocks';
import { getDocumentColorVariables, type DocumentColors } from '../utils/documentColors';
import { styleObjectToCss } from '../utils/documentStructure';
import { modal } from '../utils/modalDialog';

interface Props {
  isDark: boolean;
  documentStyle?: DocumentColors;
  onClose: () => void;
  onInsert: (block: string) => void;
}

type CategoryFilter = 'all' | 'builtin' | 'custom';

function getTemplateIcon(template: HtmlTemplate) {
  const id = template.id.toLowerCase();
  const title = template.title.toLowerCase();
  if (id.includes('metric') || title.includes('指标') || title.includes('数据')) return BarChart2;
  if (id.includes('timeline') || title.includes('里程碑') || title.includes('时间线')) return GitCommit;
  if (id.includes('checklist') || title.includes('验收') || title.includes('清单')) return CheckSquare;
  if (id.includes('callout') || title.includes('提示') || title.includes('风险')) return AlertTriangle;
  if (id.includes('comparison') || title.includes('对比') || title.includes('矩阵')) return Columns;
  if (id.includes('team') || title.includes('团队') || title.includes('成员')) return Users;
  if (id.includes('process') || title.includes('流程') || title.includes('步骤')) return Layers;
  if (id.includes('signature') || title.includes('签字') || title.includes('签署')) return PenLine;
  if (id.includes('project') || title.includes('信息') || title.includes('卡片')) return LayoutGrid;
  return FileCode2;
}

const REGISTERED_CSS_VARIABLES = [
  { name: '--primary-color', label: '主题主色', desc: '文档主要强调色，常用于卡片标题与主标识' },
  { name: '--accent-color', label: '强调辅助色', desc: '辅助标签、徽标与次级强调色' },
  { name: '--text-color', label: '正文文字色', desc: '主要阅读正文内容颜色' },
  { name: '--text-secondary', label: '辅助文本色', desc: '字段标签、注解与副标题颜色' },
  { name: '--text-muted', label: '弱化文本色', desc: '微型注脚、页码与低对比度文字' },
  { name: '--border-color', label: '主边框色', desc: '页眉下划线、主卡片边框与深色区隔线' },
  { name: '--border-light', label: '浅边框色', desc: '页脚分割线、细线分割及表格内横线' },
  { name: '--img-border-color', label: '图片边框色', desc: '图片装饰边框与卡片外框' },
];

const CARD_COLOR_PRESETS = [
  { name: '继承全局', primary: '', accent: '', desc: '跟随文档当前全局主题' },
  { name: '深蓝商务', primary: '#0f172a', accent: '#2563eb', secondary: '#64748b', border: '#cbd5e1' },
  { name: '科技蔚蓝', primary: '#0369a1', accent: '#0284c7', secondary: '#0ea5e9', border: '#bae6fd' },
  { name: '政企朱红', primary: '#881337', accent: '#e11d48', secondary: '#f43f5e', border: '#fecdd3' },
  { name: '现代极简', primary: '#18181b', accent: '#52525b', secondary: '#71717a', border: '#e4e4e7' },
  { name: '典雅紫罗兰', primary: '#4c1d95', accent: '#7c3aed', secondary: '#8b5cf6', border: '#ddd6fe' },
  { name: '生机翡翠', primary: '#064e3b', accent: '#059669', secondary: '#10b981', border: '#a7f3d0' },
  { name: '暖调琥珀', primary: '#451a03', accent: '#d97706', secondary: '#b45309', border: '#fde68a' },
  { name: '静谧黛青', primary: '#134e4a', accent: '#0d9488', secondary: '#14b8a6', border: '#99f6e4' },
];

export function HtmlTemplateManager({ isDark, documentStyle, onClose, onInsert }: Props) {
  const [templates, setTemplates] = useState<HtmlTemplate[]>([]);
  const [draft, setDraft] = useState<HtmlTemplate>(BUILTIN_HTML_TEMPLATES[0]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [activeView, setActiveView] = useState<'preview' | 'code'>('preview');
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>({});
  const [bakeConcreteColors, setBakeConcreteColors] = useState<boolean>(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<'html' | 'css'>('html');
  const [copiedCode, setCopiedCode] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const builtin = BUILTIN_HTML_TEMPLATES.some((template) => template.id === draft.id);
  const saved =
    templates.find((template) => template.id === draft.id) ||
    BUILTIN_HTML_TEMPLATES.find((template) => template.id === draft.id);
  const dirty = !saved || JSON.stringify(saved) !== JSON.stringify(draft);

  useEffect(() => {
    try {
      setTemplates(loadHtmlTemplates());
    } catch (reason) {
      setError(`读取模板库失败：${String(reason)}`);
    }
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, []);

  async function canLeave() {
    return (
      !dirty ||
      (await modal.confirm({
        title: '未保存的模板',
        message: '放弃当前模板的修改？',
        confirmText: '放弃修改',
        variant: 'warning',
      }))
    );
  }

  async function select(template: HtmlTemplate) {
    if (!(await canLeave())) return;
    setDraft({ ...template });
    setColorOverrides({});
    setError('');
    setStatus('');
  }

  function persist(next: HtmlTemplate[]) {
    try {
      saveHtmlTemplates(next);
      setTemplates(next);
      setError('');
      return true;
    } catch (reason) {
      setError(`保存失败：${String(reason)}`);
      return false;
    }
  }

  function save() {
    if (builtin) return;
    const next = { ...draft, title: draft.title.trim() };
    if (persist([...templates.filter((template) => template.id !== draft.id), next])) {
      setDraft(next);
      setStatus('已保存到本机模板库');
    }
  }

  async function remove() {
    if (builtin || !saved) return;
    if (
      !(await modal.confirm({
        title: '删除模板',
        message: `删除“${draft.title}”？已插入文档的内容不受影响。`,
        variant: 'danger',
      }))
    )
      return;
    if (persist(templates.filter((template) => template.id !== draft.id))) {
      setDraft(BUILTIN_HTML_TEMPLATES[0]);
      setColorOverrides({});
    }
  }

  function download(items: HtmlTemplate[], name: string) {
    try {
      const url = URL.createObjectURL(new Blob([exportHtmlTemplates(items)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(String(reason));
    }
  }

  async function importFile(file: File) {
    try {
      if (file.size > 2_000_000) throw new Error('模板文件不能超过 2 MB。');
      const imported = importHtmlTemplates(await file.text());
      if (persist([...templates, ...imported])) setStatus(`已导入 ${imported.length} 个模板`);
    } catch (reason) {
      setError(`导入失败：${String(reason)}`);
    }
  }

  function handleInsertVariable(varName: string) {
    if (builtin) return;
    const snippet = `var(${varName})`;
    const currentVal = draft[tab];
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const updated = currentVal.substring(0, start) + snippet + currentVal.substring(end);
      setDraft({ ...draft, [tab]: updated });
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + snippet.length, start + snippet.length);
      }, 0);
    } else {
      setDraft({ ...draft, [tab]: currentVal + snippet });
    }
  }

  // Base colors from documentStyle
  const baseDocumentColors = getDocumentColorVariables(documentStyle);
  const activeEffectiveColors = {
    ...baseDocumentColors,
    ...colorOverrides,
  };

  // Generate the block for insertion or copying
  function getPreparedBlock(bake: boolean) {
    if (!bake) {
      return buildHtmlTemplateBlock(draft);
    }
    let css = draft.css;
    let html = draft.html;
    for (const [varName, colorVal] of Object.entries(activeEffectiveColors)) {
      if (!colorVal) continue;
      const regex = new RegExp(`var\\(\\s*${varName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:\\s*,[^)]+)?\\)`, 'g');
      css = css.replace(regex, colorVal);
      html = html.replace(regex, colorVal);
    }
    return buildHtmlTemplateBlock({ css, html });
  }

  let defaultBlock = '';
  let previewError = '';
  try {
    defaultBlock = buildHtmlTemplateBlock(draft);
  } catch (reason) {
    previewError = String(reason);
  }

  const finalBlockToInsert = getPreparedBlock(bakeConcreteColors);

  async function handleCopyBlockCode() {
    if (!finalBlockToInsert) return;
    try {
      await navigator.clipboard.writeText(finalBlockToInsert);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setStatus('复制失败，请手动在代码区域复制');
    }
  }

  // The iframe preview gets activeEffectiveColors in its :root
  const preview = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: http: data: blob:; font-src 'none';"><style>:root{${styleObjectToCss(activeEffectiveColors)}}body{margin:24px 20px;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;color:var(--text-color);background-color:transparent;}*{box-sizing:border-box}img{max-width:100%}</style></head><body>${sanitizeDocumentHtml(defaultBlock)}</body></html>`;

  // Filter templates
  const filteredBuiltin = BUILTIN_HTML_TEMPLATES.filter((template) =>
    `${template.title} ${template.description}`.toLowerCase().includes(query.toLowerCase())
  );
  const filteredCustom = templates.filter((template) =>
    `${template.title} ${template.description}`.toLowerCase().includes(query.toLowerCase())
  );

  const displayList =
    categoryFilter === 'builtin'
      ? [{ label: '系统内置模板', items: filteredBuiltin }]
      : categoryFilter === 'custom'
        ? [{ label: '我的自定义模板', items: filteredCustom }]
        : [
            { label: '系统内置模板', items: filteredBuiltin },
            { label: '我的自定义模板', items: filteredCustom },
          ];

  const totalCount = BUILTIN_HTML_TEMPLATES.length + templates.length;
  const hasCustomizedColors = Object.keys(colorOverrides).length > 0;

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) void canLeave().then((leave) => leave && onClose());
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="HTML 模板管理"
        className={`w-full max-w-6xl h-[92dvh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isDark
            ? 'bg-zinc-900 border-zinc-700/80 text-zinc-100 shadow-black/60'
            : 'bg-white border-slate-200 text-slate-800 shadow-slate-900/15'
        }`}
        onKeyDown={(event) => {
          if (document.querySelector('[role="alertdialog"]')) return;
          if (event.key === 'Escape') {
            event.stopPropagation();
            void canLeave().then((leave) => leave && onClose());
          }
          if (event.key !== 'Tab') return;
          const targets = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([type="file"]), textarea, iframe'
            ) || []
          );
          const first = targets[0];
          const last = targets.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        {/* Top Header Bar */}
        <header
          className={`flex items-center justify-between px-5 py-3 border-b shrink-0 ${
            isDark ? 'border-zinc-800 bg-zinc-900/90' : 'border-slate-200/90 bg-slate-50/70'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-50">HTML 模板工坊</h2>
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-normal">
                  共 {totalCount} 款组件 · {templates.length} 自定义
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 hidden sm:block">
                快速浏览、调整配色并直接插入到 A4 文档中，支持实时色彩调优与源码定制
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border shadow-sm ${
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
              title="新增模板"
              aria-label="新增模板"
              onClick={() => {
                setActiveView('code');
                void select({
                  id: crypto.randomUUID(),
                  title: '新设计卡片',
                  description: '自定义 HTML 组件',
                  css: '.custom-card {\n  padding: 16px;\n  border: 1px solid var(--border-light, var(--img-border-color));\n  border-radius: 8px;\n  background: #fff;\n}\n.custom-card-title {\n  margin: 0 0 6px;\n  color: var(--primary-color);\n  font-size: 14px;\n  font-weight: 700;\n}\n.custom-card-desc {\n  margin: 0;\n  font-size: 12px;\n  color: var(--text-secondary, var(--text-color));\n}',
                  html: '<div class="custom-card">\n  <div class="custom-card-title">自定义组件标题</div>\n  <p class="custom-card-desc">在此编写自定义卡片正文或结构内容，色彩将自动关联主题变量。</p>\n</div>',
                });
              }}
            >
              <Plus className="w-3.5 h-3.5 text-blue-500" />
              <span>新建模板</span>
            </button>

            <button
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-slate-200/70 text-slate-600'
              }`}
              title="导入模板 JSON"
              aria-label="导入模板 JSON"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">导入 JSON</span>
            </button>

            <button
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-slate-200/70 text-slate-600'
              }`}
              title="导出自定义模板库"
              aria-label="导出自定义模板库"
              disabled={!templates.length}
              onClick={() => download(templates, 'sdc-html-templates.json')}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">导出全部</span>
            </button>

            <div className={`w-[1px] h-5 mx-1 ${isDark ? 'bg-zinc-700' : 'bg-slate-200'}`} />

            <button
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
              }`}
              title="关闭"
              aria-label="关闭 HTML 模板管理"
              onClick={() => void canLeave().then((leave) => leave && onClose())}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = '';
            }}
          />
        </header>

        {/* Content Body: Sidebar + Main Workspace */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Sidebar: Template Gallery & Filters */}
          <aside
            className={`md:w-72 shrink-0 border-b md:border-b-0 md:border-r flex flex-col ${
              isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-slate-200 bg-slate-50/50'
            }`}
          >
            {/* Search Box */}
            <div className="p-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 opacity-40 pointer-events-none" />
                <input
                  aria-label="搜索 HTML 模板"
                  placeholder="搜索模板名称或说明..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={`w-full rounded-lg pl-8 pr-7 py-1.5 text-xs outline-none transition-all ${
                    isDark
                      ? 'bg-zinc-950 border border-zinc-800 focus:border-blue-500 text-zinc-100 placeholder:text-zinc-600'
                      : 'bg-white border border-slate-200 focus:border-blue-500 text-slate-800 placeholder:text-slate-400'
                  }`}
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-2 p-0.5 rounded text-xs opacity-50 hover:opacity-100"
                    title="清空搜索"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-3 pb-2">
              <div
                className={`flex items-center p-0.5 rounded-lg text-xs ${
                  isDark ? 'bg-zinc-950 border border-zinc-800/80' : 'bg-slate-200/70'
                }`}
              >
                {(
                  [
                    ['all', '全部'],
                    ['builtin', '官方内置'],
                    ['custom', '自定义'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setCategoryFilter(key)}
                    className={`flex-1 py-1 rounded-md text-[11px] font-medium transition-all ${
                      categoryFilter === key
                        ? isDark
                          ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                          : 'bg-white text-slate-900 shadow-sm'
                        : isDark
                          ? 'text-zinc-400 hover:text-zinc-200'
                          : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Items Scroll List */}
            <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-4">
              {displayList.map(
                ({ label, items }) =>
                  items.length > 0 && (
                    <section key={label} className="space-y-1">
                      <div className="px-2 py-1 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-zinc-500 flex items-center justify-between">
                        <span>{label}</span>
                        <span className="font-mono text-[10px] tabular-nums">{items.length}</span>
                      </div>
                      <div className="space-y-1">
                        {items.map((template) => {
                          const isSelected = draft.id === template.id;
                          const isBuiltinItem = BUILTIN_HTML_TEMPLATES.some((t) => t.id === template.id);
                          const IconComponent = getTemplateIcon(template);

                          return (
                            <button
                              key={template.id}
                              onClick={() => void select(template)}
                              className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 flex items-start gap-2.5 group relative ${
                                isSelected
                                  ? isDark
                                    ? 'bg-blue-600/20 border border-blue-500/40 text-blue-300 shadow-sm'
                                    : 'bg-blue-50/90 border border-blue-200/90 text-blue-900 shadow-sm'
                                  : isDark
                                    ? 'border border-transparent hover:bg-zinc-800/60 text-zinc-200'
                                    : 'border border-transparent hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                  isSelected
                                    ? isDark
                                      ? 'bg-blue-500 text-white shadow-sm'
                                      : 'bg-blue-600 text-white shadow-sm'
                                    : isDark
                                      ? 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200 group-hover:bg-zinc-700'
                                      : 'bg-slate-200/70 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-200'
                                }`}
                              >
                                <IconComponent className="w-3.5 h-3.5" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-semibold truncate leading-tight">
                                    {template.title}
                                  </span>
                                  {isBuiltinItem ? (
                                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-normal shrink-0">
                                      内置
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-normal shrink-0">
                                      自定义
                                    </span>
                                  )}
                                </div>
                                <span className="block text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5 leading-normal">
                                  {template.description || '无详细说明'}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  )
              )}

              {filteredBuiltin.length === 0 && filteredCustom.length === 0 && (
                <div className="text-center py-10 px-4">
                  <HelpCircle className="w-8 h-8 mx-auto text-slate-400 dark:text-zinc-600 mb-2 stroke-[1.5]" />
                  <p className="text-xs text-slate-500 dark:text-zinc-400">未找到匹配的模板</p>
                  <button
                    onClick={() => setQuery('')}
                    className="mt-2 text-xs text-blue-500 hover:underline"
                  >
                    清除搜索词
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* Main Working Area: Inspector, Editor & Preview */}
          <main
            className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden ${
              isDark ? 'bg-zinc-900' : 'bg-slate-50/30'
            }`}
          >
            {/* Top Toolbar for Active Draft */}
            <div
              className={`px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
                isDark ? 'border-zinc-800 bg-zinc-900/80' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                    builtin
                      ? isDark
                        ? 'bg-zinc-800 text-zinc-300'
                        : 'bg-slate-100 text-slate-600'
                      : isDark
                        ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/40'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}
                >
                  {builtin ? '系统内置' : '自定义模板'}
                </span>

                {dirty && (
                  <span className="text-xs text-amber-500 dark:text-amber-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    未保存修改
                  </span>
                )}

                {hasCustomizedColors && (
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/40">
                    已调色
                  </span>
                )}
              </div>

              {/* View Switcher: Preview & Colors vs Code */}
              <div
                className={`flex items-center p-0.5 rounded-lg border text-xs ${
                  isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveView('preview')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    activeView === 'preview'
                      ? isDark
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                        : 'bg-white text-slate-900 shadow-sm'
                      : isDark
                        ? 'text-zinc-400 hover:text-zinc-200'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                  <span>渲染预览与调色</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('code')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    activeView === 'code'
                      ? isDark
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                        : 'bg-white text-slate-900 shadow-sm'
                      : isDark
                        ? 'text-zinc-400 hover:text-zinc-200'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>定制源码 (HTML/CSS)</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                    isDark
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                  title="复制为自定义模板"
                  aria-label="复制为自定义模板"
                  onClick={() => {
                    setActiveView('code');
                    void select({
                      ...draft,
                      id: crypto.randomUUID(),
                      title: `${draft.title}（副本）`,
                    });
                  }}
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                  <span>复制为副本</span>
                </button>

                <button
                  className={`p-1.5 rounded-lg border transition-colors ${
                    isDark
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                  title="导出当前模板"
                  aria-label="导出当前模板"
                  onClick={() => download([draft], `sdc-${draft.id || 'template'}.json`)}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <button
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-white ${
                    builtin || !dirty || !draft.title.trim() || !draft.html.trim() || !!previewError
                      ? 'opacity-40 cursor-not-allowed bg-blue-600'
                      : 'bg-blue-600 hover:bg-blue-500 shadow-sm shadow-blue-600/20 active:scale-[0.98]'
                  }`}
                  title="保存模板"
                  aria-label="保存模板"
                  disabled={builtin || !dirty || !draft.title.trim() || !draft.html.trim() || !!previewError}
                  onClick={save}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>保存模板</span>
                </button>

                {!builtin && (
                  <button
                    className={`p-1.5 rounded-lg border border-transparent text-rose-500 hover:bg-rose-50 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:border-rose-800/40 transition-colors disabled:opacity-40 disabled:pointer-events-none`}
                    title="删除模板"
                    aria-label="删除模板"
                    disabled={!saved}
                    onClick={() => void remove()}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Template Metadata Inputs (Title & Description) */}
            <div
              className={`px-5 py-2.5 border-b grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0 ${
                isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-slate-200/80 bg-slate-50/50'
              }`}
            >
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center justify-between mb-1">
                  <span>模板标题</span>
                  {builtin && (
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> 内置只读
                    </span>
                  )}
                </label>
                <input
                  aria-label="模板标题"
                  readOnly={builtin}
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="例如：系统架构指标卡"
                  className={`w-full rounded-lg px-3 py-1.5 text-xs outline-none transition-all ${
                    builtin
                      ? isDark
                        ? 'bg-zinc-950/40 border border-zinc-800/60 text-zinc-400 cursor-not-allowed'
                        : 'bg-slate-100/70 border border-slate-200 text-slate-500 cursor-not-allowed'
                      : isDark
                        ? 'bg-zinc-950 border border-zinc-700 focus:border-blue-500 text-zinc-100'
                        : 'bg-white border border-slate-300 focus:border-blue-500 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-center justify-between mb-1">
                  <span>说明备注</span>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">用途简述</span>
                </label>
                <input
                  aria-label="模板说明"
                  readOnly={builtin}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  placeholder="例如：适用于阶段验收汇报、交付成果核验"
                  className={`w-full rounded-lg px-3 py-1.5 text-xs outline-none transition-all ${
                    builtin
                      ? isDark
                        ? 'bg-zinc-950/40 border border-zinc-800/60 text-zinc-400 cursor-not-allowed'
                        : 'bg-slate-100/70 border border-slate-200 text-slate-500 cursor-not-allowed'
                      : isDark
                        ? 'bg-zinc-950 border border-zinc-700 focus:border-blue-500 text-zinc-100'
                        : 'bg-white border border-slate-300 focus:border-blue-500 text-slate-800'
                  }`}
                />
              </div>
            </div>

            {/* Main Area: Render either Preview & Color Tuning OR Code Editor + Preview */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* VIEW 1: Preview & Color Tuning View (Focused on what normal users need) */}
              <div
                className={`flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden ${
                  activeView === 'preview' ? 'flex' : 'hidden'
                }`}
              >
                {/* Center: Live Rendered Preview */}
                <div
                  className={`flex-1 min-h-0 flex flex-col overflow-hidden ${
                    isDark ? 'bg-zinc-950/60' : 'bg-slate-100/80'
                  }`}
                >
                  <div
                    className={`h-11 px-4 border-b flex items-center justify-between shrink-0 ${
                      isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        A4 交付文档渲染预览
                      </span>
                      {hasCustomizedColors ? (
                        <span className="truncate text-[11px] text-emerald-600 dark:text-emerald-400">
                          · 已实时应用卡片调色
                        </span>
                      ) : (
                        <span className="truncate text-[11px] text-slate-400 dark:text-zinc-500">
                          · 继承当前文档全局色彩
                        </span>
                      )}
                    </div>

                  </div>

                  {/* Simulated Document Paper Container */}
                  <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-auto flex items-start justify-center">
                    <div
                      className="w-full max-w-full bg-white rounded-xl shadow-md border border-slate-200/90 overflow-hidden flex flex-col"
                    >
                      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>SangDocCraft A4 交付文档嵌入视图</span>
                        <span className="font-mono text-[10px]">HTML BLOCK</span>
                      </div>

                      <iframe
                        title="HTML 模板预览"
                        sandbox="allow-same-origin"
                        srcDoc={preview}
                        className="w-full min-h-[360px] flex-1 bg-white border-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Color Tuning Panel for this Insertion */}
                <div
                  className={`lg:w-84 shrink-0 border-t lg:border-t-0 lg:border-l flex flex-col overflow-hidden ${
                    isDark ? 'border-zinc-800 bg-zinc-900/80' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className={`h-11 px-3.5 border-b flex items-center justify-between shrink-0 ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                        本次插入色彩调整
                      </span>
                    </div>

                    {hasCustomizedColors && (
                      <button
                        onClick={() => {
                          setColorOverrides({});
                          setBakeConcreteColors(false);
                        }}
                        className="text-[11px] text-blue-500 hover:text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                        title="重置所有调整，恢复文档主题默认配色"
                      >
                        <RotateCcw className="w-3 h-3" />
                        重置色彩
                      </button>
                    )}
                  </div>

                  {/* Color Adjuster Items List */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {/* Quick Color Presets for this card */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                          快速色板
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                          一键同步卡片风格
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {CARD_COLOR_PRESETS.map((p) => {
                          const isCurrentActive = p.primary
                            ? colorOverrides['--primary-color'] === p.primary && colorOverrides['--accent-color'] === p.accent
                            : !hasCustomizedColors;
                          return (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => {
                                if (!p.primary) {
                                  setColorOverrides({});
                                  setBakeConcreteColors(false);
                                } else {
                                  setBakeConcreteColors(true);
                                  setColorOverrides({
                                    '--primary-color': p.primary,
                                    '--accent-color': p.accent,
                                    '--text-secondary': p.secondary || '#64748b',
                                    '--border-color': p.border || '#cbd5e1',
                                  });
                                }
                              }}
                              className={`p-1.5 rounded-lg border text-left transition relative flex flex-col items-center gap-1 cursor-pointer ${
                                isCurrentActive
                                  ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/70 dark:bg-blue-950/40'
                                  : isDark
                                    ? 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
                                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                              }`}
                              title={p.desc}
                            >
                              <div className="flex items-center gap-1 mt-0.5">
                                {p.primary ? (
                                  <>
                                    <span className="w-2.5 h-2.5 rounded-full border border-black/10 dark:border-white/10" style={{ backgroundColor: p.primary }} />
                                    <span className="w-2.5 h-2.5 rounded-full border border-black/10 dark:border-white/10" style={{ backgroundColor: p.accent }} />
                                  </>
                                ) : (
                                  <span className="text-[10px] text-slate-400">🌐 默认</span>
                                )}
                              </div>
                              <span className="text-[10px] font-medium leading-tight truncate w-full text-center">
                                {p.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-zinc-800/80 pt-2.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                          细项变量微调
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                          点击色块调色，即时预览
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {REGISTERED_CSS_VARIABLES.map((item) => {
                          const currentColor = activeEffectiveColors[item.name as keyof typeof activeEffectiveColors] || '#0f172a';
                          const isOverridden = Object.prototype.hasOwnProperty.call(colorOverrides, item.name);

                          return (
                            <div
                              key={item.name}
                              className={`p-2 rounded-lg border transition-all ${
                                isOverridden
                                  ? isDark
                                    ? 'bg-blue-950/20 border-blue-800/50'
                                    : 'bg-blue-50/50 border-blue-200'
                                  : isDark
                                    ? 'bg-zinc-950/50 border-zinc-800/80'
                                    : 'bg-slate-50/70 border-slate-200/80'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                                      {item.label}
                                    </span>
                                    <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-500">
                                      {item.name}
                                    </span>
                                  </div>
                                  <span className="block text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                                    {item.desc}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <label className="relative w-6 h-6 rounded-md overflow-hidden border border-black/15 dark:border-white/15 cursor-pointer shadow-xs shrink-0">
                                    <input
                                      type="color"
                                      value={currentColor.startsWith('#') && currentColor.length === 7 ? currentColor : '#000000'}
                                      onChange={(e) =>
                                        setColorOverrides((prev) => ({
                                          ...prev,
                                          [item.name]: e.target.value,
                                        }))
                                      }
                                      className="absolute -top-2 -left-2 w-10 h-10 opacity-0 cursor-pointer"
                                    />
                                    <span
                                      className="block w-full h-full"
                                      style={{ backgroundColor: currentColor }}
                                    />
                                  </label>

                                  <input
                                    type="text"
                                    value={currentColor}
                                    onChange={(e) =>
                                      setColorOverrides((prev) => ({
                                        ...prev,
                                        [item.name]: e.target.value,
                                      }))
                                    }
                                    className={`w-16 font-mono text-[11px] rounded px-1.5 py-0.5 border outline-none text-center ${
                                      isDark
                                        ? 'bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-blue-500'
                                        : 'bg-white border-slate-300 text-slate-700 focus:border-blue-500'
                                    }`}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Options: Bake into concrete colors */}
                  <div
                    className={`p-3 border-t space-y-2.5 shrink-0 ${
                      isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-slate-200 bg-slate-50/80'
                    }`}
                  >
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bakeConcreteColors}
                        onChange={(e) => setBakeConcreteColors(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="text-[11px] leading-tight">
                        <span className="font-semibold text-slate-800 dark:text-zinc-200">
                          以具体颜色值插入（推荐）
                        </span>
                        <span className="block text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                          将调色结果固定为真实色值插入，不受后续文档全局主题变化影响
                        </span>
                      </div>
                    </label>

                    <button
                      onClick={() => setActiveView('code')}
                      className="w-full py-1 text-center text-[11px] text-blue-500 hover:text-blue-600 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>查看或修改 HTML / CSS 样式源码</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* VIEW 2: Code Editor + Split Preview (For developers and styling customization) */}
              <div
                className={`flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x overflow-hidden ${
                  activeView === 'code' ? 'grid' : 'hidden'
                } ${isDark ? 'divide-zinc-800' : 'divide-slate-200'}`}
              >
                {/* Left: Code Editor Pane - Styled cleanly for BOTH Light and Dark themes */}
                <div
                  className={`flex flex-col min-h-0 overflow-hidden ${
                    isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-800'
                  }`}
                >
                  {/* Editor Header Bar with Tablist & Variable Snippets */}
                  <div
                    className={`px-4 py-2 border-b flex items-center justify-between shrink-0 ${
                      isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div role="tablist" aria-label="模板源码" className="flex items-center gap-1">
                      {(['html', 'css'] as const).map((value) => (
                        <button
                          key={value}
                          role="tab"
                          aria-selected={tab === value}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            tab === value
                              ? 'bg-blue-600 text-white shadow-sm'
                              : isDark
                                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                          }`}
                          onClick={() => setTab(value)}
                        >
                          {value.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono opacity-60 tabular-nums">
                        {draft[tab].length} 字符
                      </span>
                    </div>
                  </div>

                  {/* Registered CSS Variable Quick Helpers */}
                  <div
                    className={`px-3 py-1.5 border-b flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0 scrollbar-none ${
                      isDark ? 'border-zinc-800/80 bg-zinc-900/30' : 'border-slate-200/80 bg-slate-100/60'
                    }`}
                  >
                    <span className="text-slate-400 dark:text-zinc-500 shrink-0 text-[10px]">插入色彩变量：</span>
                    {REGISTERED_CSS_VARIABLES.map((item) => (
                      <button
                        key={item.name}
                        onClick={() => handleInsertVariable(item.name)}
                        disabled={builtin}
                        title={`${item.desc} (点击插入)`}
                        className={`px-1.5 py-0.5 rounded font-mono text-[10px] shrink-0 border transition-colors disabled:opacity-40 ${
                          isDark
                            ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>

                  {/* Code Textarea with light/dark adaptive container */}
                  <div className="flex-1 min-h-0 relative p-3">
                    <textarea
                      ref={textareaRef}
                      aria-label={tab === 'html' ? '模板 HTML' : '模板 CSS'}
                      spellCheck={false}
                      readOnly={builtin}
                      value={draft[tab]}
                      onChange={(event) => setDraft({ ...draft, [tab]: event.target.value })}
                      className={`w-full h-full font-mono text-xs leading-5 p-3 rounded-xl border outline-none resize-none transition-all ${
                        builtin
                          ? isDark
                            ? 'bg-zinc-950/60 border-zinc-800 text-zinc-300'
                            : 'bg-slate-100/70 border-slate-200 text-slate-600'
                          : isDark
                            ? 'bg-zinc-950 border-zinc-800 focus:border-blue-500 text-zinc-100'
                            : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 shadow-xs'
                      }`}
                    />
                    {builtin && (
                      <div className="absolute right-6 bottom-6 pointer-events-none opacity-50 text-[11px] bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 px-2.5 py-1 rounded-md border border-slate-300 dark:border-zinc-700">
                        内置只读（点击右上角“复制为副本”即可自由编辑）
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Code Mode Preview */}
                <div
                  className={`flex flex-col min-h-0 overflow-hidden ${
                    isDark ? 'bg-zinc-950/60' : 'bg-slate-100/80'
                  }`}
                >
                  <div
                    className={`px-4 py-2 border-b flex items-center justify-between shrink-0 ${
                      isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      代码实时效果
                    </span>
                    <button
                      onClick={() => setActiveView('preview')}
                      className="text-[11px] text-blue-500 hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>返回全幅调色预览</span>
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 p-4 overflow-auto flex items-start justify-center">
                    <div className="w-full bg-white rounded-xl shadow-md border border-slate-200/90 overflow-hidden flex flex-col">
                      <iframe
                        title="HTML 模板代码预览"
                        sandbox="allow-same-origin"
                        srcDoc={preview}
                        className="w-full min-h-[340px] flex-1 bg-white border-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Footer Bar */}
        <footer
          className={`px-5 py-3 border-t flex flex-wrap items-center justify-between gap-3 shrink-0 ${
            isDark ? 'border-zinc-800 bg-zinc-900/90' : 'border-slate-200 bg-slate-50/80'
          }`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {error || previewError ? (
              <span
                role="alert"
                className="text-xs text-rose-500 flex items-center gap-1.5 font-medium truncate"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error || previewError}
              </span>
            ) : status ? (
              <span
                role="status"
                className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium truncate"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {status}
              </span>
            ) : (
              <span className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                {hasCustomizedColors
                  ? bakeConcreteColors
                    ? '本次插入将以固定的具体颜色值生效，不受后续主题切换影响'
                    : '已调色，插入时将保留动态变量'
                  : '已注册 8 项主题色彩变量，插入后随排版主题实时渲染'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyBlockCode}
              disabled={!finalBlockToInsert || !draft.html.trim()}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
              title="复制包含当前调色方案的完整 HTML 片段"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? '已复制代码' : '复制代码'}</span>
            </button>

            <button
              disabled={!finalBlockToInsert || !draft.html.trim()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-lg px-4 py-2 text-xs font-semibold shadow-sm shadow-blue-600/30 transition-all disabled:opacity-40 disabled:pointer-events-none"
              onClick={() => {
                onInsert(finalBlockToInsert);
              }}
            >
              <FileCode className="w-4 h-4" />
              <span>插入模板</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
