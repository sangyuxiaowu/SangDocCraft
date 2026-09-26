import React from 'react';
import type { CoverDocxRenderContext, CoverRenderContext, CoverTemplatePlugin } from '../contracts';
import { CoverMetadata, coverMetadataDocx, coverMetadataHtml } from '../coverMetadata';
import { renderStandardDocx } from './standardDocx';

function renderThumbnail(): React.ReactNode {
  return <div className="h-full flex flex-col justify-between items-center text-center py-1"><div className="w-8 h-1 rounded-full bg-blue-500/30" /><div className="space-y-0.5 my-auto"><div className="w-12 h-1.5 bg-slate-800 rounded mx-auto" /><div className="w-8 h-1 bg-blue-500 rounded mx-auto" /><div className="w-4 h-0.5 bg-blue-500 rounded mx-auto mt-1" /></div><div className="w-full space-y-0.5 px-0.5"><div className="h-0.5 bg-slate-200 w-full" /><div className="h-0.5 bg-slate-200 w-full" /><div className="h-0.5 bg-slate-200 w-full" /></div></div>;
}

async function renderDocx(context: CoverDocxRenderContext) {
  const children = await renderStandardDocx({ ...context, coverListItems: [] });
  children.push(...coverMetadataDocx(context));
  return children;
}

function renderPreview(context: CoverRenderContext): React.ReactNode {
  const { meta, cover, style } = context;
  const hasHeader = Boolean(cover.logoUrl || meta.organization || meta.number);
  const hasTitle = Boolean(meta.title || meta.subtitle);
  const hasMeta = Boolean(context.coverListItems?.length);

  return <div className="flex-1 flex flex-col justify-between py-6 text-center">
    {hasHeader ? <div className="pt-2 space-y-2">
      {cover.logoUrl && <img src={cover.logoUrl} alt="Logo" style={{ height: cover.logoHeight }} className="h-10 w-auto object-contain mx-auto mb-2" />}
      {meta.organization && <div className="text-xs font-bold tracking-[0.2em]" style={{ color: style.primaryColor }}>{meta.organization}</div>}
      {meta.number && <div className="text-[11px] font-mono font-medium text-slate-400">NO. {meta.number}</div>}
    </div> : <div />}
    {hasTitle ? <div className="space-y-4 max-w-xl mx-auto my-auto py-8">
      {meta.title && <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight" style={{ color: style.primaryColor }}>{meta.title}</h1>}
      {meta.subtitle && <p className="text-base md:text-lg font-medium" style={{ color: style.accentColor }}>{meta.subtitle}</p>}
      <div className="w-20 h-1 mx-auto my-6 rounded-full" style={{ backgroundColor: style.accentColor }} />
    </div> : <div />}
    {hasMeta ? <div className="pb-4"><CoverMetadata context={context} /></div> : <div />}
  </div>;
}

function renderHtml(context: CoverRenderContext): string {
  const { meta, cover } = context;
  const hasHeader = Boolean(cover.logoUrl || meta.organization || meta.number);
  const hasTitle = Boolean(meta.title || meta.subtitle);
  const hasMeta = Boolean(context.coverListItems?.length);

  return `${hasHeader ? `<div><div style="margin-bottom:10px;">${cover.logoUrl ? `<img src="${cover.logoUrl}" style="${cover.logoHeight === undefined ? 'max-height:36px;' : `height:${cover.logoHeight}px;max-height:none;width:auto;`}margin:0 auto 10px;display:block;" alt="Logo" />` : ''}${meta.organization ? `<div style="font-size:11px;letter-spacing:2px;font-weight:700;color:var(--primary-color);">${meta.organization}</div>` : ''}</div>${meta.number ? `<div style="font-size:11px;font-family:monospace;color:#94a3b8;">NO. ${meta.number}</div>` : ''}</div>` : '<div></div>'}${hasTitle ? `<div style="margin:auto 0;padding:20px 0;">${meta.title ? `<div class="cover-title">${meta.title}</div>` : ''}${meta.subtitle ? `<div class="cover-subtitle">${meta.subtitle}</div>` : ''}<div class="cover-divider"></div></div>` : '<div></div>'}${hasMeta ? `<div style="padding-bottom:16px;">${coverMetadataHtml(context)}</div>` : '<div></div>'}`;
}

export const enterpriseCoverPlugin: CoverTemplatePlugin = {
  id: 'enterprise', name: '🏢 企业经典', description: '经典居中与元数据表', defaultLogoHeight: 40, defaultCoverListColumns: 1,
  renderThumbnail, renderPreview, renderHtml, renderDocx,
};