import React from 'react';
import { AlignmentType, BorderStyle, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { CoverDocxRenderContext, CoverRenderContext, CoverTemplatePlugin } from './contracts';
import { CoverMetadata, coverMetadataDocx, coverMetadataHtml } from './coverMetadata';
import type { CoverListItem } from '../types';
import { splitLeadingEmoji } from '../utils/coverEmoji';

const hasLabelSuffix = (label: string) => label.includes(':') || label.includes('：');

function enterpriseThumbnail(): React.ReactNode {
  return <div className="h-full flex flex-col justify-between items-center text-center py-1"><div className="w-8 h-1 rounded-full bg-blue-500/30" /><div className="space-y-0.5 my-auto"><div className="w-12 h-1.5 bg-slate-800 rounded mx-auto" /><div className="w-8 h-1 bg-blue-500 rounded mx-auto" /><div className="w-4 h-0.5 bg-blue-500 rounded mx-auto mt-1" /></div><div className="w-full space-y-0.5 px-0.5"><div className="h-0.5 bg-slate-200 w-full" /><div className="h-0.5 bg-slate-200 w-full" /><div className="h-0.5 bg-slate-200 w-full" /></div></div>;
}

function modernThumbnail(): React.ReactNode {
  return <div className="h-full flex flex-col justify-between p-0.5 border-l-2 border-l-blue-600"><div className="flex justify-between items-center"><div className="w-5 h-0.5 bg-slate-400 rounded-xs" /><div className="w-3 h-1 bg-blue-500 rounded-full" /></div><div className="space-y-0.5 my-auto"><div className="w-14 h-2 bg-slate-900 rounded-xs" /><div className="w-8 h-1 bg-blue-500 rounded-xs" /><div className="w-5 h-0.5 bg-blue-500 rounded-xs mt-0.5" /></div><div className="w-full h-3 bg-slate-100 rounded-xs p-0.5 space-y-0.5"><div className="h-0.5 bg-slate-300 w-3/4" /><div className="h-0.5 bg-slate-300 w-1/2" /></div></div>;
}

function specThumbnail(): React.ReactNode {
  return <div className="h-full border border-double border-slate-700 p-0.5 flex flex-col justify-between"><div className="text-center border-b border-slate-200 pb-0.5"><div className="w-8 h-0.5 bg-slate-600 mx-auto" /></div><div className="text-center space-y-0.5 my-auto"><div className="w-6 h-0.5 bg-slate-300 mx-auto" /><div className="w-12 h-1.5 bg-slate-900 mx-auto" /><div className="w-8 h-1 bg-red-600 mx-auto" /></div><div className="w-full h-2.5 bg-slate-50 border border-slate-200 rounded-xs p-0.5"><div className="h-0.5 bg-slate-300 w-full" /></div></div>;
}

function minimalThumbnail(): React.ReactNode {
  return <div className="h-full flex flex-col justify-between p-1 text-left"><div className="w-5 h-0.5 bg-slate-300" /><div className="space-y-0.5 my-auto"><div className="w-14 h-1.5 bg-slate-800" /><div className="w-8 h-0.5 bg-slate-400" /><div className="w-4 h-px bg-slate-300 mt-1" /></div><div className="space-y-0.5"><div className="w-8 h-0.5 bg-slate-400" /><div className="w-6 h-0.5 bg-slate-300" /></div></div>;
}

function creativeThumbnail(): React.ReactNode {
  return <div className="h-full flex flex-col justify-between p-0.5"><div className="w-full h-6 rounded-xs bg-gradient-to-br from-purple-600 to-blue-500 p-1"><div className="w-8 h-1 bg-white/90 rounded-xs" /><div className="w-5 h-0.5 bg-white/70 rounded-xs mt-0.5" /></div><div className="grid grid-cols-2 gap-0.5 my-auto w-full"><div className="h-2 bg-slate-100 rounded-xs" /><div className="h-2 bg-slate-100 rounded-xs" /><div className="h-2 bg-slate-100 rounded-xs" /><div className="h-2 bg-slate-100 rounded-xs" /></div><div className="w-8 h-0.5 bg-slate-300 mx-auto" /></div>;
}

async function renderStandardDocx(context: CoverDocxRenderContext): Promise<(Paragraph | Table)[]> {
  const { meta, coverListItems, primaryHex, accentHex, textHex, fontName, createImageRun } = context;
  const children: (Paragraph | Table)[] = [];
  const logoSource = meta.logo || meta.logoUrl;
  if (logoSource) {
    const logo = meta.logoHeight === undefined
      ? await createImageRun(logoSource, '文档标志')
      : await createImageRun(logoSource, '文档标志', undefined, meta.logoHeight);
    if (logo) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 }, children: [logo] }));
  }
  if (meta.title) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 400 }, children: [new TextRun({ text: meta.title, bold: true, size: 52, color: primaryHex, font: fontName })] }));
  }
  if (meta.subtitle) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 1200 }, children: [new TextRun({ text: meta.subtitle, size: 28, color: accentHex, font: fontName })] }));
  if (meta.title || meta.subtitle) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 1600 }, children: [new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', color: accentHex, size: 20 })] }));
  }
  // 注意：DOCX 端用的是「label：value」两列表格，没有独立的 emoji 列，
  // 因此这里**刻意不**调用 splitLeadingEmoji —— 拆出来的 emoji 无处安放，
  // 反而会把 emoji 与 label 分到不同单元格。
  // 若将来要统一三端，需要先给 DOCX 定义一个 emoji 列，再复用 splitLeadingEmoji。
  if (coverListItems.length) children.push(new Table({
    width: { size: 8000, type: WidthType.DXA }, alignment: AlignmentType.CENTER,
    borders: { top: { style: BorderStyle.NONE, size: 0, color: 'auto' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' }, left: { style: BorderStyle.NONE, size: 0, color: 'auto' }, right: { style: BorderStyle.NONE, size: 0, color: 'auto' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' } },
    rows: coverListItems.map((item) => new TableRow({ children: [
      new TableCell({ width: { size: 2500, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${item.label}${hasLabelSuffix(item.label) ? '' : '：'}`, bold: true, size: 22, color: primaryHex, font: fontName })] })] }),
      new TableCell({ width: { size: 5500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: item.value, size: 22, color: textHex, font: fontName })] })] }),
    ] })),
  }));
  return children;
}

async function renderEnterpriseDocx(context: CoverDocxRenderContext): Promise<(Paragraph | Table)[]> {
  const children = await renderStandardDocx({ ...context, coverListItems: [] });
  children.push(...coverMetadataDocx(context));
  return children;
}

function enterprisePreview(context: CoverRenderContext): React.ReactNode {
  const { meta, style } = context;
  const hasHeader = Boolean(meta.logo || meta.logoUrl || meta.organization || meta.number);
  const hasTitle = Boolean(meta.title || meta.subtitle);
  const hasMeta = Boolean(context.coverListItems?.length);

  return <div className="flex-1 flex flex-col justify-between py-6 text-center">
    {hasHeader ? <div className="pt-2 space-y-2">
      {(meta.logo || meta.logoUrl) && <img src={meta.logo || meta.logoUrl} alt="Logo" style={{ height: meta.logoHeight }} className="h-10 w-auto object-contain mx-auto mb-2" />}
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

function modernPreview({ meta, style, coverListItems }: CoverRenderContext): React.ReactNode {
  const hasTop = Boolean(meta.logo || meta.logoUrl || meta.organization || meta.number);
  const hasTitle = Boolean(meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return <div className="flex-1 flex flex-col justify-between py-6 px-4 relative border-l-4" style={{ borderColor: style.accentColor }}>
    {hasTop ? <div className="flex items-center justify-between pt-2">
      <div className="flex items-center gap-3">
        {(meta.logo || meta.logoUrl) && <img src={meta.logo || meta.logoUrl} alt="Logo" style={{ height: meta.logoHeight }} className="h-8 w-auto object-contain" />}
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

function specPreview({ meta, style, coverListItems }: CoverRenderContext): React.ReactNode {
  const hasHeader = Boolean(meta.logo || meta.logoUrl || meta.organization);
  const hasTitle = Boolean(meta.number || meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return <div className="flex-1 flex flex-col justify-between p-6 border-2 border-double rounded-sm my-1" style={{ borderColor: style.primaryColor }}>
    {hasHeader ? <div className="text-center border-b pb-3 space-y-1" style={{ borderColor: `${style.primaryColor}30` }}>
      {(meta.logo || meta.logoUrl) && <img src={meta.logo || meta.logoUrl} alt="Logo" style={{ height: meta.logoHeight }} className="h-8 w-auto object-contain mx-auto mb-1" />}
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

function minimalPreview({ meta, style, coverListItems }: CoverRenderContext): React.ReactNode {
  const hasTop = Boolean(meta.organization || meta.logo || meta.logoUrl);
  const hasTitle = Boolean(meta.number || meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return <div className="flex-1 flex flex-col justify-between py-8 px-4 text-left">
    {hasTop ? <div className="flex items-center justify-between">
      {meta.organization && <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">{meta.organization}</span>}
      {(meta.logo || meta.logoUrl) && <img src={meta.logo || meta.logoUrl} alt="Logo" style={{ height: meta.logoHeight }} className="h-6 w-auto object-contain opacity-80 ml-auto" />}
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

function creativePreview({ meta, style, coverListItems }: CoverRenderContext): React.ReactNode {
  const hasBanner = Boolean(meta.organization || meta.logo || meta.logoUrl || meta.number || meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return <div className="flex-1 flex flex-col justify-between py-4">
    {hasBanner ? <div className="rounded-2xl p-7 text-white shadow-md space-y-3 relative overflow-hidden flex flex-col justify-between" style={{ background: `linear-gradient(135deg, ${style.primaryColor}, ${style.accentColor})` }}>
      {(meta.organization || meta.logo || meta.logoUrl) && <div className="flex items-center justify-between">
        {meta.organization && <div className="text-xs uppercase font-bold tracking-widest opacity-80">{meta.organization}</div>}
        {(meta.logo || meta.logoUrl) && <img src={meta.logo || meta.logoUrl} alt="Logo" style={{ height: meta.logoHeight }} className="h-7 w-auto object-contain brightness-0 invert opacity-90 ml-auto" />}
      </div>}
      <div>
        {meta.number && <div className="text-[10px] font-mono tracking-wider opacity-75 mb-1">NO. {meta.number}</div>}
        {meta.title && <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">{meta.title}</h1>}
        {meta.subtitle && <p className="text-sm font-medium opacity-90 mt-2">{meta.subtitle}</p>}
      </div>
    </div> : <div />}
    {hasMeta ? <div className="grid grid-cols-2 gap-3 my-auto py-6">{coverListItems.map((item, index) => {
      // 【卡片式封面专属：emoji 独立成列】
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

function enterpriseHtml(context: CoverRenderContext): string {
  const { meta } = context;
  const hasHeader = Boolean(meta.logo || meta.logoUrl || meta.organization || meta.number);
  const hasTitle = Boolean(meta.title || meta.subtitle);
  const hasMeta = Boolean(context.coverListItems?.length);

  return `${hasHeader ? `<div><div style="margin-bottom:10px;">${(meta.logo || meta.logoUrl) ? `<img src="${meta.logo || meta.logoUrl}" style="${logoHeightStyle(meta.logoHeight, 36)}margin:0 auto 10px;display:block;" alt="Logo" />` : ''}${meta.organization ? `<div style="font-size:11px;letter-spacing:2px;font-weight:700;color:var(--primary-color);">${meta.organization}</div>` : ''}</div>${meta.number ? `<div style="font-size:11px;font-family:monospace;color:#94a3b8;">NO. ${meta.number}</div>` : ''}</div>` : '<div></div>'}${hasTitle ? `<div style="margin:auto 0;padding:20px 0;">${meta.title ? `<div class="cover-title">${meta.title}</div>` : ''}${meta.subtitle ? `<div class="cover-subtitle">${meta.subtitle}</div>` : ''}<div class="cover-divider"></div></div>` : '<div></div>'}${hasMeta ? `<div style="padding-bottom:16px;">${coverMetadataHtml(context)}</div>` : '<div></div>'}`;
}
function modernHtml({ meta, coverListItems }: CoverRenderContext): string {
  const hasTop = Boolean(meta.logo || meta.logoUrl || meta.organization || meta.number);
  const hasTitle = Boolean(meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return `<div style="border-left:4px solid var(--accent-color);padding-left:20px;flex:1;height:100%;display:flex;flex-direction:column;justify-content:space-between;text-align:left;">${hasTop ? `<div style="display:flex;justify-content:space-between;align-items:center;"><div style="display:flex;align-items:center;gap:10px;">${(meta.logo || meta.logoUrl) ? `<img src="${meta.logo || meta.logoUrl}" style="${logoHeightStyle(meta.logoHeight, 28)}object-fit:contain;" alt="Logo" />` : ''}${meta.organization ? `<span style="font-size:12px;font-weight:bold;color:var(--primary-color);background:rgba(0,0,0,.05);padding:4px 12px;border-radius:4px;">${meta.organization}</span>` : ''}</div>${meta.number ? `<span style="background:var(--accent-color);color:#fff;padding:3px 12px;border-radius:9999px;font-size:11px;font-family:monospace;font-weight:bold;">${meta.number}</span>` : ''}</div>` : '<div></div>'}${hasTitle ? `<div style="margin:auto 0;padding:20px 0;">${meta.title ? `<div class="cover-title" style="text-align:left;font-size:36px;font-weight:900;">${meta.title}</div>` : ''}${meta.subtitle ? `<div class="cover-subtitle" style="text-align:left;font-size:18px;">${meta.subtitle}</div>` : ''}<div style="height:5px;width:80px;background:var(--accent-color);border-radius:3px;margin-top:15px;"></div></div>` : '<div></div>'}${hasMeta ? `<div class="cover-meta-grid">${coverListItems.map((item) => `<div class="grid-item"><div class="grid-item-label">${item.label}</div><div class="grid-item-value">${item.value}</div></div>`).join('')}</div>` : '<div></div>'}</div>`;
}
function specHtml({ meta, coverListItems }: CoverRenderContext): string {
  const hasHeader = Boolean(meta.logo || meta.logoUrl || meta.organization);
  const hasTitle = Boolean(meta.number || meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return `<div style="border:2px double var(--primary-color);padding:20px;height:100%;display:flex;flex-direction:column;justify-content:space-between;">${hasHeader ? `<div style="text-align:center;border-bottom:1px solid #cbd5e1;padding-bottom:10px;">${(meta.logo || meta.logoUrl) ? `<img src="${meta.logo || meta.logoUrl}" style="${logoHeightStyle(meta.logoHeight, 28)}object-fit:contain;margin:0 auto 6px;display:block;" alt="Logo" />` : ''}${meta.organization ? `<div style="font-weight:bold;font-size:12px;color:var(--primary-color);letter-spacing:2px;text-transform:uppercase;">${meta.organization}</div>` : ''}</div>` : '<div></div>'}${hasTitle ? `<div style="text-align:center;margin:auto 0;padding:20px 0;">${meta.number ? `<div style="font-size:11px;font-weight:bold;color:#64748b;margin-bottom:8px;font-family:monospace;">文档编号：${meta.number}</div>` : ''}${meta.title ? `<div class="cover-title" style="font-size:32px;">${meta.title}</div>` : ''}${meta.subtitle ? `<div class="cover-subtitle" style="font-size:16px;">${meta.subtitle}</div>` : ''}</div>` : '<div></div>'}${hasMeta ? `<div class="spec-meta-box">${coverListItems.map((item) => `<div class="spec-grid-item"><span class="label">${item.label}${hasLabelSuffix(item.label) ? '' : '：'}</span><span class="value">${item.value}</span></div>`).join('')}</div>` : '<div></div>'}</div>`;
}
function minimalHtml({ meta, coverListItems }: CoverRenderContext): string {
  const hasTop = Boolean(meta.organization || meta.logo || meta.logoUrl);
  const hasTitle = Boolean(meta.number || meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return `<div style="text-align:left;flex:1;height:100%;display:flex;flex-direction:column;justify-content:space-between;">${hasTop ? `<div style="display:flex;justify-content:space-between;align-items:center;">${meta.organization ? `<div style="font-size:11px;font-family:monospace;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;">${meta.organization}</div>` : '<div></div>'}${(meta.logo || meta.logoUrl) ? `<img src="${meta.logo || meta.logoUrl}" style="${logoHeightStyle(meta.logoHeight, 24)}object-fit:contain;" alt="Logo" />` : ''}</div>` : '<div></div>'}${hasTitle ? `<div style="margin:auto 0;padding:20px 0;">${meta.number ? `<div style="font-size:11px;font-family:monospace;color:#94a3b8;margin-bottom:8px;">NO. ${meta.number}</div>` : ''}${meta.title ? `<div class="cover-title" style="text-align:left;font-size:40px;font-weight:300;">${meta.title}</div>` : ''}${meta.subtitle ? `<div class="cover-subtitle" style="text-align:left;font-size:16px;color:#64748b;">${meta.subtitle}</div>` : ''}${(meta.title || meta.subtitle) ? '<div style="height:1px;width:50px;background:#cbd5e1;margin-top:20px;"></div>' : ''}</div>` : '<div></div>'}${hasMeta ? `<div style="font-size:11px;color:#64748b;font-family:monospace;border-top:1px solid #e2e8f0;padding-top:14px;">${coverListItems.map((item) => `<div><span style="color:#94a3b8;">${item.label} /</span> ${item.value}</div>`).join('')}</div>` : '<div></div>'}</div>`;
}
/**
 * 「🎨 现代渐变」单个元信息卡片的 HTML。
 */
function creativeCardHtml(item: CoverListItem): string {
  const { emoji, label } = splitLeadingEmoji(item.label);
  return `<div class="creative-card">${emoji ? `<span class="emoji">${emoji}</span>` : ''}<div style="overflow:hidden;width:100%;"><div class="label">${label}</div><div class="value">${item.value}</div></div></div>`;
}

function creativeHtml({ meta, style, coverListItems }: CoverRenderContext): string {
  const hasBanner = Boolean(meta.organization || meta.logo || meta.logoUrl || meta.number || meta.title || meta.subtitle);
  const hasMeta = Boolean(coverListItems?.length);

  return `<div style="flex:1;height:100%;display:flex;flex-direction:column;justify-content:space-between;">${hasBanner ? `<div style="background:linear-gradient(135deg,${style.primaryColor},${style.accentColor});color:#fff;padding:28px 24px;border-radius:16px;text-align:left;">${(meta.organization || meta.logo || meta.logoUrl) ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">${meta.organization ? `<div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:.9;">${meta.organization}</div>` : '<div></div>'}${(meta.logo || meta.logoUrl) ? `<img src="${meta.logo || meta.logoUrl}" style="${logoHeightStyle(meta.logoHeight, 24)}filter:brightness(0) invert(1);" alt="Logo" />` : ''}</div>` : ''}${meta.number ? `<div style="font-size:11px;font-family:monospace;opacity:.8;">NO. ${meta.number}</div>` : ''}${meta.title ? `<div style="font-size:30px;font-weight:800;line-height:1.2;">${meta.title}</div>` : ''}${meta.subtitle ? `<div style="font-size:14px;margin-top:8px;opacity:.9;">${meta.subtitle}</div>` : ''}</div>` : '<div></div>'}${hasMeta ? `<div class="creative-grid">${coverListItems.map(creativeCardHtml).join('')}</div>` : '<div></div>'}${meta.department ? `<div style="text-align:center;font-size:10px;color:#94a3b8;letter-spacing:2px;font-weight:bold;">${meta.department}</div>` : '<div></div>'}</div>`;
}

function logoHeightStyle(height: number | undefined, defaultHeight: number): string {
  return height === undefined ? `max-height:${defaultHeight}px;` : `height:${height}px;max-height:none;width:auto;`;
}

export const builtinCoverPlugins: CoverTemplatePlugin[] = [
  { id: 'enterprise', name: '🏢 企业经典', description: '经典居中与元数据表', defaultLogoHeight: 40, defaultCoverListColumns: 1, renderThumbnail: enterpriseThumbnail, renderPreview: enterprisePreview, renderHtml: enterpriseHtml, renderDocx: renderEnterpriseDocx },
  { id: 'modern', name: '💻 科技现代', description: '侧边深色条纹与卡片', defaultLogoHeight: 32, renderThumbnail: modernThumbnail, renderPreview: modernPreview, renderHtml: modernHtml, renderDocx: renderStandardDocx },
  { id: 'spec', name: '📜 政企规范', description: '双边框与文件编号', defaultLogoHeight: 32, renderThumbnail: specThumbnail, renderPreview: specPreview, renderHtml: specHtml, renderDocx: renderStandardDocx },
  { id: 'minimal', name: '🌿 极简黑白', description: '高雅留白与纤细字号', defaultLogoHeight: 24, renderThumbnail: minimalThumbnail, renderPreview: minimalPreview, renderHtml: minimalHtml, renderDocx: renderStandardDocx },
  { id: 'creative', name: '🎨 现代渐变', description: '渐变 Banner 与图示卡片', defaultLogoHeight: 28, renderThumbnail: creativeThumbnail, renderPreview: creativePreview, renderHtml: creativeHtml, renderDocx: renderStandardDocx },
];
