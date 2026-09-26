import React from 'react';
import type { CoverRenderContext, CoverTemplatePlugin } from '../contracts';
import type { CoverListItem } from '../../types';
import { splitLeadingEmoji } from '../../utils/coverEmoji';
import { renderStandardDocx } from './standardDocx';

function renderThumbnail(): React.ReactNode {
  return <div className="h-full flex flex-col justify-between p-0.5"><div className="w-full h-6 rounded-xs bg-gradient-to-br from-purple-600 to-blue-500 p-1"><div className="w-8 h-1 bg-white/90 rounded-xs" /><div className="w-5 h-0.5 bg-white/70 rounded-xs mt-0.5" /></div><div className="grid grid-cols-2 gap-0.5 my-auto w-full"><div className="h-2 bg-slate-100 rounded-xs" /><div className="h-2 bg-slate-100 rounded-xs" /><div className="h-2 bg-slate-100 rounded-xs" /><div className="h-2 bg-slate-100 rounded-xs" /></div><div className="w-8 h-0.5 bg-slate-300 mx-auto" /></div>;
}

function renderPreview({ meta, cover, style, coverListItems }: CoverRenderContext): React.ReactNode {
  const hasBanner = Boolean(meta.organization || cover.logoUrl || meta.number || meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return <div className="flex-1 flex flex-col justify-between py-4">
    {hasBanner ? <div className="rounded-2xl p-7 text-white shadow-md space-y-3 relative overflow-hidden flex flex-col justify-between" style={{ background: `linear-gradient(135deg, ${style.primaryColor}, ${style.accentColor})` }}>
      {(meta.organization || cover.logoUrl) && <div className="flex items-center justify-between">
        {meta.organization && <div className="text-xs uppercase font-bold tracking-widest opacity-80">{meta.organization}</div>}
        {cover.logoUrl && <img src={cover.logoUrl} alt="Logo" style={{ height: cover.logoHeight }} className="h-7 w-auto object-contain brightness-0 invert opacity-90 ml-auto" />}
      </div>}
      <div>
        {meta.number && <div className="text-[10px] font-mono tracking-wider opacity-75 mb-1">NO. {meta.number}</div>}
        {meta.title && <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">{meta.title}</h1>}
        {meta.subtitle && <p className="text-sm font-medium opacity-90 mt-2">{meta.subtitle}</p>}
      </div>
    </div> : <div />}
    {hasMeta ? <div className="grid grid-cols-2 gap-3 my-auto py-6">{coverListItems.map((item, index) => {
      const { emoji, label } = splitLeadingEmoji(item.label);
      return <div key={index} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
        {emoji ? <span className="text-base shrink-0 select-none leading-none flex items-center justify-center">{emoji}</span> : null}
        <div className="overflow-hidden">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{label}</div>
          <div className="text-xs font-bold text-slate-800 truncate">{item.value}</div>
        </div>
      </div>;
    })}</div> : <div />}
    {meta.department ? <div className="text-center text-[10px] font-bold tracking-widest uppercase text-slate-400">{meta.department}</div> : <div />}
  </div>;
}

function creativeCardHtml(item: CoverListItem): string {
  const { emoji, label } = splitLeadingEmoji(item.label);
  return `<div class="creative-card">${emoji ? `<span class="emoji">${emoji}</span>` : ''}<div style="overflow:hidden;width:100%;"><div class="label">${label}</div><div class="value">${item.value}</div></div></div>`;
}

function renderHtml({ meta, cover, style, coverListItems }: CoverRenderContext): string {
  const hasBanner = Boolean(meta.organization || cover.logoUrl || meta.number || meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return `<div style="flex:1;height:100%;display:flex;flex-direction:column;justify-content:space-between;">${hasBanner ? `<div style="background:linear-gradient(135deg,${style.primaryColor},${style.accentColor});color:#fff;padding:28px 24px;border-radius:16px;text-align:left;">${(meta.organization || cover.logoUrl) ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">${meta.organization ? `<div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:.9;">${meta.organization}</div>` : '<div></div>'}${cover.logoUrl ? `<img src="${cover.logoUrl}" style="${cover.logoHeight === undefined ? 'max-height:24px;' : `height:${cover.logoHeight}px;max-height:none;width:auto;`}filter:brightness(0) invert(1);" alt="Logo" />` : ''}</div>` : ''}${meta.number ? `<div style="font-size:11px;font-family:monospace;opacity:.8;">NO. ${meta.number}</div>` : ''}${meta.title ? `<div style="font-size:30px;font-weight:800;line-height:1.2;">${meta.title}</div>` : ''}${meta.subtitle ? `<div style="font-size:14px;margin-top:8px;opacity:.9;">${meta.subtitle}</div>` : ''}</div>` : '<div></div>'}${hasMeta ? `<div class="creative-grid">${coverListItems.map(creativeCardHtml).join('')}</div>` : '<div></div>'}${meta.department ? `<div style="text-align:center;font-size:10px;color:#94a3b8;letter-spacing:2px;font-weight:bold;">${meta.department}</div>` : '<div></div>'}</div>`;
}

export const creativeCoverPlugin: CoverTemplatePlugin = {
  id: 'creative', name: '🎨 现代渐变', description: '渐变 Banner 与图示卡片', defaultLogoHeight: 28,
  renderThumbnail, renderPreview, renderHtml, renderDocx: renderStandardDocx,
};