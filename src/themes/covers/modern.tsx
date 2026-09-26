import React from 'react';
import type { CoverRenderContext, CoverTemplatePlugin } from '../contracts';
import { renderStandardDocx } from './standardDocx';

function renderThumbnail(): React.ReactNode {
  return <div className="h-full flex flex-col justify-between p-0.5 border-l-2 border-l-blue-600"><div className="flex justify-between items-center"><div className="w-5 h-0.5 bg-slate-400 rounded-xs" /><div className="w-3 h-1 bg-blue-500 rounded-full" /></div><div className="space-y-0.5 my-auto"><div className="w-14 h-2 bg-slate-900 rounded-xs" /><div className="w-8 h-1 bg-blue-500 rounded-xs" /><div className="w-5 h-0.5 bg-blue-500 rounded-xs mt-0.5" /></div><div className="w-full h-3 bg-slate-100 rounded-xs p-0.5 space-y-0.5"><div className="h-0.5 bg-slate-300 w-3/4" /><div className="h-0.5 bg-slate-300 w-1/2" /></div></div>;
}

function renderPreview({ meta, cover, style, coverListItems }: CoverRenderContext): React.ReactNode {
  const hasTop = Boolean(cover.logoUrl || meta.organization || meta.number);
  const hasTitle = Boolean(meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return <div className="flex-1 flex flex-col justify-between py-6 px-4 relative border-l-4" style={{ borderColor: style.accentColor }}>
    {hasTop ? <div className="flex items-center justify-between pt-2">
      <div className="flex items-center gap-3">
        {cover.logoUrl && <img src={cover.logoUrl} alt="Logo" style={{ height: cover.logoHeight }} className="h-8 w-auto object-contain" />}
        {meta.organization && <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded" style={{ color: style.primaryColor, backgroundColor: `${style.primaryColor}15` }}>{meta.organization}</span>}
      </div>
      {meta.number && <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full text-white shadow-xs" style={{ backgroundColor: style.accentColor }}>{meta.number}</span>}
    </div> : <div />}
    {hasTitle ? <div className="my-auto py-10 space-y-4 pr-4">
      {meta.title && <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight" style={{ color: style.primaryColor }}>{meta.title}</h1>}
      {meta.subtitle && <p className="text-lg md:text-xl font-semibold opacity-90" style={{ color: style.accentColor }}>{meta.subtitle}</p>}
      <div className="w-32 h-1.5 rounded" style={{ backgroundColor: style.accentColor }} />
    </div> : <div />}
    {hasMeta ? <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">{coverListItems.map((item, index) => <div key={index} className="space-y-0.5"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</div><div className="font-semibold text-slate-800">{item.value}</div></div>)}</div> : <div />}
  </div>;
}

function renderHtml({ meta, cover, coverListItems }: CoverRenderContext): string {
  const hasTop = Boolean(cover.logoUrl || meta.organization || meta.number);
  const hasTitle = Boolean(meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return `<div style="border-left:4px solid var(--accent-color);padding-left:20px;flex:1;height:100%;display:flex;flex-direction:column;justify-content:space-between;text-align:left;">${hasTop ? `<div style="display:flex;justify-content:space-between;align-items:center;"><div style="display:flex;align-items:center;gap:10px;">${cover.logoUrl ? `<img src="${cover.logoUrl}" style="${cover.logoHeight === undefined ? 'max-height:28px;' : `height:${cover.logoHeight}px;max-height:none;width:auto;`}object-fit:contain;" alt="Logo" />` : ''}${meta.organization ? `<span style="font-size:12px;font-weight:bold;color:var(--primary-color);background:rgba(0,0,0,.05);padding:4px 12px;border-radius:4px;">${meta.organization}</span>` : ''}</div>${meta.number ? `<span style="background:var(--accent-color);color:#fff;padding:3px 12px;border-radius:9999px;font-size:11px;font-family:monospace;font-weight:bold;">${meta.number}</span>` : ''}</div>` : '<div></div>'}${hasTitle ? `<div style="margin:auto 0;padding:20px 0;">${meta.title ? `<div class="cover-title" style="text-align:left;font-size:36px;font-weight:900;">${meta.title}</div>` : ''}${meta.subtitle ? `<div class="cover-subtitle" style="text-align:left;font-size:18px;">${meta.subtitle}</div>` : ''}<div style="height:5px;width:80px;background:var(--accent-color);border-radius:3px;margin-top:15px;"></div></div>` : '<div></div>'}${hasMeta ? `<div class="cover-meta-grid">${coverListItems.map((item) => `<div class="grid-item"><div class="grid-item-label">${item.label}</div><div class="grid-item-value">${item.value}</div></div>`).join('')}</div>` : '<div></div>'}</div>`;
}

export const modernCoverPlugin: CoverTemplatePlugin = {
  id: 'modern', name: '💻 科技现代', description: '侧边深色条纹与卡片', defaultLogoHeight: 32,
  renderThumbnail, renderPreview, renderHtml, renderDocx: renderStandardDocx,
};