import React from 'react';
import type { CoverRenderContext, CoverTemplatePlugin } from '../contracts';
import { renderStandardDocx } from './standardDocx';

const hasLabelSuffix = (label: string) => label.includes(':') || label.includes('：');

function renderThumbnail(): React.ReactNode {
  return <div className="h-full border border-double border-slate-700 p-0.5 flex flex-col justify-between"><div className="text-center border-b border-slate-200 pb-0.5"><div className="w-8 h-0.5 bg-slate-600 mx-auto" /></div><div className="text-center space-y-0.5 my-auto"><div className="w-6 h-0.5 bg-slate-300 mx-auto" /><div className="w-12 h-1.5 bg-slate-900 mx-auto" /><div className="w-8 h-1 bg-red-600 mx-auto" /></div><div className="w-full h-2.5 bg-slate-50 border border-slate-200 rounded-xs p-0.5"><div className="h-0.5 bg-slate-300 w-full" /></div></div>;
}

function renderPreview({ meta, cover, style, coverListItems }: CoverRenderContext): React.ReactNode {
  const hasHeader = Boolean(cover.logoUrl || meta.organization);
  const hasTitle = Boolean(meta.number || meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return <div className="flex-1 flex flex-col justify-between p-6 border-2 border-double rounded-sm my-1" style={{ borderColor: style.primaryColor }}>
    {hasHeader ? <div className="text-center border-b pb-3 space-y-1" style={{ borderColor: `${style.primaryColor}30` }}>
      {cover.logoUrl && <img src={cover.logoUrl} alt="Logo" style={{ height: cover.logoHeight }} className="h-8 w-auto object-contain mx-auto mb-1" />}
      {meta.organization && <div className="text-xs font-bold uppercase tracking-widest" style={{ color: style.primaryColor }}>{meta.organization}</div>}
    </div> : <div />}
    {hasTitle ? <div className="text-center my-auto py-8 space-y-4">
      {meta.number && <div className="text-xs font-mono font-bold px-3 py-1 inline-block rounded bg-slate-100 text-slate-700 border border-slate-200">文档编号：{meta.number}</div>}
      {meta.title && <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: style.primaryColor }}>{meta.title}</h1>}
      {meta.subtitle && <p className="text-base font-bold" style={{ color: style.accentColor }}>{meta.subtitle}</p>}
    </div> : <div />}
    {hasMeta ? <div className="border rounded p-4 text-xs bg-slate-50/50" style={{ borderColor: `${style.primaryColor}30` }}><div className="grid grid-cols-2 gap-y-2.5 gap-x-4">{coverListItems.map((item, index) => <div key={index} className="flex items-center gap-2"><span className="font-bold text-slate-500 shrink-0">{item.label}{hasLabelSuffix(item.label) ? '' : '：'}</span><span className="font-semibold text-slate-900 truncate">{item.value}</span></div>)}</div></div> : <div />}
  </div>;
}

function renderHtml({ meta, cover, coverListItems }: CoverRenderContext): string {
  const hasHeader = Boolean(cover.logoUrl || meta.organization);
  const hasTitle = Boolean(meta.number || meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return `<div style="border:2px double var(--primary-color);padding:20px;height:100%;display:flex;flex-direction:column;justify-content:space-between;">${hasHeader ? `<div style="text-align:center;border-bottom:1px solid #cbd5e1;padding-bottom:10px;">${cover.logoUrl ? `<img src="${cover.logoUrl}" style="${cover.logoHeight === undefined ? 'max-height:28px;' : `height:${cover.logoHeight}px;max-height:none;width:auto;`}object-fit:contain;margin:0 auto 6px;display:block;" alt="Logo" />` : ''}${meta.organization ? `<div style="font-weight:bold;font-size:12px;color:var(--primary-color);letter-spacing:2px;text-transform:uppercase;">${meta.organization}</div>` : ''}</div>` : '<div></div>'}${hasTitle ? `<div style="text-align:center;margin:auto 0;padding:20px 0;">${meta.number ? `<div style="font-size:11px;font-weight:bold;color:#64748b;margin-bottom:8px;font-family:monospace;">文档编号：${meta.number}</div>` : ''}${meta.title ? `<div class="cover-title" style="font-size:32px;">${meta.title}</div>` : ''}${meta.subtitle ? `<div class="cover-subtitle" style="font-size:16px;">${meta.subtitle}</div>` : ''}</div>` : '<div></div>'}${hasMeta ? `<div class="spec-meta-box">${coverListItems.map((item) => `<div class="spec-grid-item"><span class="label">${item.label}${hasLabelSuffix(item.label) ? '' : '：'}</span><span class="value">${item.value}</span></div>`).join('')}</div>` : '<div></div>'}</div>`;
}

export const specCoverPlugin: CoverTemplatePlugin = {
  id: 'spec', name: '📜 政企规范', description: '双边框与文件编号', defaultLogoHeight: 32,
  renderThumbnail, renderPreview, renderHtml, renderDocx: renderStandardDocx,
};