import React from 'react';
import type { CoverRenderContext, CoverTemplatePlugin } from '../contracts';
import { renderStandardDocx } from './standardDocx';

function renderThumbnail(): React.ReactNode {
  return <div className="h-full flex flex-col justify-between p-1 text-left"><div className="w-5 h-0.5 bg-slate-300" /><div className="space-y-0.5 my-auto"><div className="w-14 h-1.5 bg-slate-800" /><div className="w-8 h-0.5 bg-slate-400" /><div className="w-4 h-px bg-slate-300 mt-1" /></div><div className="space-y-0.5"><div className="w-8 h-0.5 bg-slate-400" /><div className="w-6 h-0.5 bg-slate-300" /></div></div>;
}

function renderPreview({ meta, cover, style, coverListItems }: CoverRenderContext): React.ReactNode {
  const hasTop = Boolean(meta.organization || cover.logoUrl);
  const hasTitle = Boolean(meta.number || meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return <div className="flex-1 flex flex-col justify-between py-8 px-4 text-left">
    {hasTop ? <div className="flex items-center justify-between">
      {meta.organization && <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">{meta.organization}</span>}
      {cover.logoUrl && <img src={cover.logoUrl} alt="Logo" style={{ height: cover.logoHeight }} className="h-6 w-auto object-contain opacity-80 ml-auto" />}
    </div> : <div />}
    {hasTitle ? <div className="my-auto py-12 space-y-6">
      {meta.number && <div className="text-xs font-mono text-slate-400 tracking-wider">NO. {meta.number}</div>}
      {meta.title && <h1 className="text-4xl md:text-5xl font-light tracking-tight leading-none" style={{ color: style.primaryColor }}>{meta.title}</h1>}
      {meta.subtitle && <p className="text-base font-normal text-slate-500 max-w-lg">{meta.subtitle}</p>}
      {(meta.title || meta.subtitle) && <div className="w-12 h-px bg-slate-300 my-4" />}
    </div> : <div />}
    {hasMeta ? <div className="space-y-1.5 text-xs text-slate-600 font-mono border-t pt-4 border-slate-200">{coverListItems.map((item, index) => <div key={index}><span className="text-slate-400 uppercase">{item.label} /</span> {item.value}</div>)}</div> : <div />}
  </div>;
}

function renderHtml({ meta, cover, coverListItems }: CoverRenderContext): string {
  const hasTop = Boolean(meta.organization || cover.logoUrl);
  const hasTitle = Boolean(meta.number || meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return `<div style="text-align:left;flex:1;height:100%;display:flex;flex-direction:column;justify-content:space-between;">${hasTop ? `<div style="display:flex;justify-content:space-between;align-items:center;">${meta.organization ? `<div style="font-size:11px;font-family:monospace;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;">${meta.organization}</div>` : '<div></div>'}${cover.logoUrl ? `<img src="${cover.logoUrl}" style="${cover.logoHeight === undefined ? 'max-height:24px;' : `height:${cover.logoHeight}px;max-height:none;width:auto;`}object-fit:contain;" alt="Logo" />` : ''}</div>` : '<div></div>'}${hasTitle ? `<div style="margin:auto 0;padding:20px 0;">${meta.number ? `<div style="font-size:11px;font-family:monospace;color:#94a3b8;margin-bottom:8px;">NO. ${meta.number}</div>` : ''}${meta.title ? `<div class="cover-title" style="text-align:left;font-size:40px;font-weight:300;">${meta.title}</div>` : ''}${meta.subtitle ? `<div class="cover-subtitle" style="text-align:left;font-size:16px;color:#64748b;">${meta.subtitle}</div>` : ''}${(meta.title || meta.subtitle) ? '<div style="height:1px;width:50px;background:#cbd5e1;margin-top:20px;"></div>' : ''}</div>` : '<div></div>'}${hasMeta ? `<div style="font-size:11px;color:#64748b;font-family:monospace;border-top:1px solid #e2e8f0;padding-top:14px;">${coverListItems.map((item) => `<div><span style="color:#94a3b8;">${item.label} /</span> ${item.value}</div>`).join('')}</div>` : '<div></div>'}</div>`;
}

export const minimalCoverPlugin: CoverTemplatePlugin = {
  id: 'minimal', name: '🌿 极简黑白', description: '高雅留白与纤细字号', defaultLogoHeight: 24,
  renderThumbnail, renderPreview, renderHtml, renderDocx: renderStandardDocx,
};