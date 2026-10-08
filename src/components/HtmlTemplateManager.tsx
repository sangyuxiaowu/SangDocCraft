import { useEffect, useRef, useState } from 'react';
import { Copy, Download, FileCode, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { BUILTIN_HTML_TEMPLATES } from '../data/htmlTemplates';
import type { HtmlTemplate } from '../types/htmlTemplate';
import { buildHtmlTemplateBlock, exportHtmlTemplates, importHtmlTemplates, loadHtmlTemplates, saveHtmlTemplates } from '../utils/htmlTemplateStore';
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

export function HtmlTemplateManager({ isDark, documentStyle, onClose, onInsert }: Props) {
  const [templates, setTemplates] = useState<HtmlTemplate[]>([]);
  const [draft, setDraft] = useState<HtmlTemplate>(BUILTIN_HTML_TEMPLATES[0]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<'html' | 'css'>('html');
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const builtin = BUILTIN_HTML_TEMPLATES.some(template => template.id === draft.id);
  const saved = templates.find(template => template.id === draft.id) || BUILTIN_HTML_TEMPLATES.find(template => template.id === draft.id);
  const dirty = !saved || JSON.stringify(saved) !== JSON.stringify(draft);

  useEffect(() => {
    try { setTemplates(loadHtmlTemplates()); }
    catch (reason) { setError(`读取模板库失败：${String(reason)}`); }
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus();
  }, []);

  async function canLeave() {
    return !dirty || await modal.confirm({ title: '未保存的模板', message: '放弃当前模板的修改？', confirmText: '放弃修改', variant: 'warning' });
  }

  async function select(template: HtmlTemplate) {
    if (!await canLeave()) return;
    setDraft({ ...template }); setError(''); setStatus('');
  }

  function persist(next: HtmlTemplate[]) {
    try { saveHtmlTemplates(next); setTemplates(next); setError(''); return true; }
    catch (reason) { setError(`保存失败：${String(reason)}`); return false; }
  }

  function save() {
    if (builtin) return;
    const next = { ...draft, title: draft.title.trim() };
    if (persist([...templates.filter(template => template.id !== draft.id), next])) {
      setDraft(next); setStatus('已保存到本机模板库');
    }
  }

  async function remove() {
    if (builtin || !saved) return;
    if (!await modal.confirm({ title: '删除模板', message: `删除“${draft.title}”？已插入文档的内容不受影响。`, variant: 'danger' })) return;
    if (persist(templates.filter(template => template.id !== draft.id))) setDraft(BUILTIN_HTML_TEMPLATES[0]);
  }

  function download(items: HtmlTemplate[], name: string) {
    try {
      const url = URL.createObjectURL(new Blob([exportHtmlTemplates(items)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError(String(reason)); }
  }

  async function importFile(file: File) {
    try {
      if (file.size > 2_000_000) throw new Error('模板文件不能超过 2 MB。');
      const imported = importHtmlTemplates(await file.text());
      if (persist([...templates, ...imported])) setStatus(`已导入 ${imported.length} 个模板`);
    } catch (reason) { setError(`导入失败：${String(reason)}`); }
  }

  let block = '';
  let previewError = '';
  try { block = buildHtmlTemplateBlock(draft); }
  catch (reason) { previewError = String(reason); }
  const preview = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: http: data: blob:; font-src 'none';"><style>:root{${styleObjectToCss(getDocumentColorVariables(documentStyle))}}body{margin:20px;font:14px/1.6 'Microsoft YaHei',sans-serif;color:var(--text-color)}*{box-sizing:border-box}img{max-width:100%}</style></head><body>${sanitizeDocumentHtml(block)}</body></html>`;
  const fieldClass = `w-full rounded border px-2 py-1.5 text-sm outline-none focus:border-blue-500 ${isDark ? 'bg-zinc-950 border-zinc-700' : 'bg-white border-slate-300'}`;
  const toolClass = `p-2 rounded hover:bg-blue-500/10 disabled:opacity-40 disabled:cursor-not-allowed`;

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-2 sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) void canLeave().then(leave => leave && onClose()); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="HTML 模板管理" className={`w-full max-w-6xl h-[90dvh] rounded-lg border shadow-2xl flex flex-col overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'}`}
        onKeyDown={event => {
          if (document.querySelector('[role="alertdialog"]')) return;
          if (event.key === 'Escape') { event.stopPropagation(); void canLeave().then(leave => leave && onClose()); }
          if (event.key !== 'Tab') return;
          const targets = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([type="file"]), textarea, iframe') || []);
          const first = targets[0]; const last = targets.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus(); }
        }}>
        <header className="flex items-center gap-2 border-b border-current/10 px-4 py-2 shrink-0">
          <FileCode className="w-5 h-5 text-blue-500" /><h2 className="text-sm font-semibold">HTML 模板</h2>
          <div className="ml-auto flex items-center gap-1">
            <button className={toolClass} title="新增模板" aria-label="新增模板" onClick={() => void select({ id: crypto.randomUUID(), title: '新模板', description: '', css: '', html: '<p>正文内容</p>' })}><Plus className="w-4 h-4" /></button>
            <button className={toolClass} title="导入模板 JSON" aria-label="导入模板 JSON" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" /></button>
            <button className={toolClass} title="导出自定义模板库" aria-label="导出自定义模板库" disabled={!templates.length} onClick={() => download(templates, 'sdc-html-templates.json')}><Download className="w-4 h-4" /></button>
            <button className={toolClass} title="关闭" aria-label="关闭 HTML 模板管理" onClick={() => void canLeave().then(leave => leave && onClose())}><X className="w-4 h-4" /></button>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ''; }} />
        </header>
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-current/10 flex flex-col max-h-44 md:max-h-none">
            <label className="relative m-3"><Search className="absolute left-2 top-2.5 w-4 h-4 opacity-50" /><input aria-label="搜索 HTML 模板" placeholder="搜索模板" value={query} onChange={event => setQuery(event.target.value)} className={`${fieldClass} pl-8`} /></label>
            <div className="overflow-auto px-2 pb-2">
              {([['内置模板', BUILTIN_HTML_TEMPLATES], ['自定义模板', templates]] as const).map(([label, items]) => (
                <section key={label} className="mb-3">
                  <h3 className="px-2 py-1 text-xs opacity-60">{label} · {items.length}</h3>
                  {items.filter(template => `${template.title} ${template.description}`.toLowerCase().includes(query.toLowerCase())).map(template => (
                    <button key={template.id} onClick={() => void select(template)} className={`block text-left w-full px-2 py-2 rounded text-sm break-words ${draft.id === template.id ? 'bg-blue-500/15 text-blue-500' : 'hover:bg-blue-500/5'}`}>
                      {template.title}<span className="block text-xs opacity-60 mt-1">{template.description}</span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          </aside>
          <main className="flex-1 min-w-0 min-h-0 overflow-auto p-3 sm:p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs opacity-60 mr-auto">{builtin ? '内置模板' : '自定义模板'}{dirty ? ' · 未保存' : ''}</span>
              <button className={toolClass} title="复制为自定义模板" aria-label="复制为自定义模板" onClick={() => void select({ ...draft, id: crypto.randomUUID(), title: `${draft.title}（副本）` })}><Copy className="w-4 h-4" /></button>
              <button className={toolClass} title="导出当前模板" aria-label="导出当前模板" onClick={() => download([draft], 'sdc-html-template.json')}><Download className="w-4 h-4" /></button>
              <button className={toolClass} title="保存模板" aria-label="保存模板" disabled={builtin || !dirty || !draft.title.trim() || !draft.html.trim() || !!previewError} onClick={save}><Save className="w-4 h-4" /></button>
              <button className={`${toolClass} text-red-500`} title="删除模板" aria-label="删除模板" disabled={builtin || !saved} onClick={() => void remove()}><Trash2 className="w-4 h-4" /></button>
            </div>
            <label className="text-xs">模板标题<input aria-label="模板标题" readOnly={builtin} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} className={`${fieldClass} mt-1`} /></label>
            <label className="text-xs">说明<input aria-label="模板说明" readOnly={builtin} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} className={`${fieldClass} mt-1`} /></label>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-[360px]">
              <div className="flex flex-col min-w-0">
                <div role="tablist" aria-label="模板源码" className="flex border-b border-current/10 mb-2">
                  {(['html', 'css'] as const).map(value => <button key={value} role="tab" aria-selected={tab === value} className={`px-4 py-2 text-xs border-b-2 ${tab === value ? 'border-blue-500 text-blue-500' : 'border-transparent'}`} onClick={() => setTab(value)}>{value.toUpperCase()}</button>)}
                </div>
                <textarea aria-label={tab === 'html' ? '模板 HTML' : '模板 CSS'} spellCheck={false} readOnly={builtin} value={draft[tab]} onChange={event => setDraft({ ...draft, [tab]: event.target.value })} className={`${fieldClass} font-mono text-xs leading-5 flex-1 min-h-48 resize-none`} />
              </div>
              <div className="flex flex-col min-w-0"><h3 className="py-2 mb-2 text-xs">预览</h3><iframe title="HTML 模板预览" sandbox="allow-same-origin" srcDoc={preview} className="w-full flex-1 min-h-48 rounded border border-slate-300 bg-white" /></div>
            </div>
          </main>
        </div>
        <footer className="flex flex-wrap gap-2 items-center border-t border-current/10 px-4 py-3 shrink-0">
          <span role={error || previewError ? 'alert' : 'status'} className={`flex-1 min-w-0 break-words text-xs ${error || previewError ? 'text-red-500' : 'text-emerald-500'}`}>{error || previewError || status}</span>
          <button disabled={!block || !draft.html.trim()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-2 text-sm disabled:opacity-40" onClick={() => { onInsert(block); }}><FileCode className="w-4 h-4" />插入模板</button>
        </footer>
      </div>
    </div>
  );
}