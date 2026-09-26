import React from 'react';
import { AlignmentType, BorderStyle, Paragraph, Table, TableCell, TableRow, TextDirection, TextRun, WidthType } from 'docx';
import type { CoverDocxRenderContext, CoverRenderContext } from '../contracts';
import { CoverMetadata, coverMetadataDocx, coverMetadataHtml } from '../coverMetadata';

export function renderThumbnail(briefing = false, verticalTitle = false): React.ReactNode {
  return <div className="h-full flex flex-col p-0.5">
    <div className={`w-6 h-2 ${briefing ? 'bg-emerald-700' : 'bg-blue-800'}`} />
    <div className="w-8 h-px bg-slate-400 mt-1" />
    <div className={`mt-3 space-y-1 ${briefing ? '' : 'self-center'}`}>
      <div className={verticalTitle ? 'w-1.5 h-10 bg-slate-800 mx-auto' : 'w-10 h-1.5 bg-slate-800'} />
      {!verticalTitle && <div className={`w-7 h-px ${briefing ? 'bg-emerald-600' : 'bg-slate-400 mx-auto'}`} />}
    </div>
    <div className="mt-auto grid grid-cols-2 gap-x-2 gap-y-1 pb-2">
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-px bg-slate-400" />)}
    </div>
    <div className={`w-8 h-px bg-slate-600 mt-1 ${briefing ? '' : 'mx-auto'}`} />
    <div className={`w-5 h-px bg-slate-300 mt-1 ${briefing ? '' : 'mx-auto'}`} />
  </div>;
}

export function renderPreview(context: CoverRenderContext, briefing = false, verticalTitle = false): React.ReactNode {
  const { meta, cover, style } = context;
  const hasTop = Boolean(cover.logoUrl || meta.number);
  const hasTitle = Boolean(meta.title || (!verticalTitle && meta.subtitle));
  const hasMeta = Boolean(context.coverListItems?.length);

  return <div data-cover-template={verticalTitle ? 'research' : briefing ? 'briefing' : 'signature'} style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px', textAlign: briefing ? 'left' : 'center', color: style.textColor, overflowWrap: 'anywhere', letterSpacing: 0 }}>
    {hasTop && <div style={{ textAlign: 'left', paddingBottom: briefing ? 20 : 0, borderBottom: briefing ? `2px solid ${style.primaryColor}` : undefined }}>
      {cover.logoUrl && <img src={cover.logoUrl} alt="Logo" style={{ height: cover.logoHeight ?? 64, maxHeight: 'none', width: 'auto', maxWidth: '100%', objectFit: 'contain', objectPosition: 'left', display: 'block' }} />}
      {meta.number && <div style={{ marginTop: cover.logoUrl ? 36 : 0, fontSize: 13 }}>文档编号：{meta.number}</div>}
    </div>}
    {hasTitle && <div style={{ margin: briefing ? 'auto 0' : '56px 0 32px', padding: briefing ? '40px 0' : 0, display: verticalTitle ? 'flex' : undefined, justifyContent: verticalTitle ? 'center' : undefined }}>
      {meta.title && <h1 style={{ margin: 0, fontSize: verticalTitle ? 42 : briefing ? 40 : 32, lineHeight: 1.5, fontWeight: briefing ? 700 : 500, color: style.primaryColor, writingMode: verticalTitle ? 'vertical-rl' : undefined, letterSpacing: verticalTitle ? 5 : undefined, maxHeight: verticalTitle ? 400 : undefined }}>{meta.title}</h1>}
      {!verticalTitle && meta.subtitle && <p style={{ margin: meta.title ? '16px 0 0' : 0, fontSize: 18, lineHeight: 1.6, color: briefing ? style.accentColor : style.textColor }}>{meta.subtitle}</p>}
      {briefing && <div style={{ width: 64, height: 3, marginTop: 28, backgroundColor: style.accentColor }} />}
    </div>}
    {hasMeta && <div style={{ marginTop: briefing ? 0 : 'auto', paddingTop: 32 }}><CoverMetadata context={context} defaultColumns={2} width="60%" /></div>}
    {(meta.organization || meta.date) && <div style={{ marginTop: briefing ? 36 : (hasMeta ? 80 : 'auto'), paddingTop: briefing ? 20 : 0, borderTop: briefing ? '1px solid #cbd5e1' : undefined, fontSize: 14, lineHeight: 1.8 }}>
      {meta.organization && <div>{meta.organization}</div>}
      {meta.date && <div style={{ marginTop: meta.organization ? 12 : 0 }}>{meta.date}</div>}
    </div>}
  </div>;
}

export function renderHtml(context: CoverRenderContext, briefing = false, verticalTitle = false): string {
  const { meta, cover, style } = context;
  const hasTop = Boolean(cover.logoUrl || meta.number);
  const hasTitle = Boolean(meta.title || (!verticalTitle && meta.subtitle));
  const hasMeta = Boolean(context.coverListItems?.length);

  return `<div data-cover-template="${verticalTitle ? 'research' : briefing ? 'briefing' : 'signature'}" style="flex:1;display:flex;flex-direction:column;padding:24px 20px;text-align:${briefing ? 'left' : 'center'};color:${style.textColor};overflow-wrap:anywhere;letter-spacing:0;">
    ${hasTop ? `<div style="text-align:left;${briefing ? `padding-bottom:20px;border-bottom:2px solid ${style.primaryColor};` : ''}">
      ${cover.logoUrl ? `<img src="${cover.logoUrl}" alt="Logo" style="height:${cover.logoHeight ?? 64}px;max-height:none;width:auto;max-width:100%;object-fit:contain;object-position:left;display:block;" />` : ''}
      ${meta.number ? `<div style="margin-top:${cover.logoUrl ? 36 : 0}px;font-size:13px;">文档编号：${meta.number}</div>` : ''}
    </div>` : ''}
    ${hasTitle ? `<div style="margin:${briefing ? 'auto 0;padding:40px 0' : '56px 0 32px'};${verticalTitle ? 'display:flex;justify-content:center;' : ''}">
      ${meta.title ? `<h1 style="margin:0;font-size:${verticalTitle ? 42 : briefing ? 40 : 32}px;line-height:1.5;font-weight:${briefing ? 700 : 500};color:${style.primaryColor};${verticalTitle ? 'writing-mode:vertical-rl;letter-spacing:5px;max-height:400px;' : ''}">${meta.title}</h1>` : ''}
      ${!verticalTitle && meta.subtitle ? `<p style="margin:${meta.title ? '16px 0 0' : '0'};font-size:18px;line-height:1.6;color:${briefing ? style.accentColor : style.textColor};">${meta.subtitle}</p>` : ''}
      ${briefing ? `<div style="width:64px;height:3px;margin-top:28px;background-color:${style.accentColor};"></div>` : ''}
    </div>` : ''}
    ${hasMeta ? `<div style="margin-top:${briefing ? '0' : 'auto'};padding-top:32px;">${coverMetadataHtml(context, 2, '60%')}</div>` : ''}
    ${(meta.organization || meta.date) ? `<div style="margin-top:${briefing ? 36 : (hasMeta ? 80 : 'auto')}px;${briefing ? 'padding-top:20px;border-top:1px solid #cbd5e1;' : ''}font-size:14px;line-height:1.8;">
      ${meta.organization ? `<div>${meta.organization}</div>` : ''}
      ${meta.date ? `<div style="margin-top:${meta.organization ? 12 : 0}px;">${meta.date}</div>` : ''}
    </div>` : ''}
  </div>`;
}

export async function renderDocx(context: CoverDocxRenderContext, briefing = false, verticalTitle = false): Promise<(Paragraph | Table)[]> {
  const { meta, cover, primaryHex, accentHex, textHex, fontName, createImageRun } = context;
  const alignment = briefing ? AlignmentType.LEFT : AlignmentType.CENTER;
  const children: (Paragraph | Table)[] = [];
  const logoSource = cover.logoUrl;
  if (logoSource) {
    const logo = await createImageRun(logoSource, '文档标志', undefined, cover.logoHeight ?? 64);
    if (logo) children.push(new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 400 }, children: [logo] }));
  }
  if (meta.number) children.push(new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: `文档编号：${meta.number}`, size: 22, color: textHex, font: fontName })] }));
  if (meta.title) {
    if (verticalTitle) {
      children.push(new Table({ alignment: AlignmentType.CENTER, width: { size: 4800, type: WidthType.DXA }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } }, rows: [new TableRow({ height: { value: 4800, rule: 'atLeast' }, children: [new TableCell({ textDirection: TextDirection.TOP_TO_BOTTOM_RIGHT_TO_LEFT, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: meta.title, size: 63, characterSpacing: 75, color: primaryHex, font: fontName })] })] })] })] }));
    } else {
      children.push(new Paragraph({ alignment, spacing: { before: briefing ? 1800 : 600, after: 240 }, border: briefing ? { bottom: { style: BorderStyle.SINGLE, size: 12, color: accentHex, space: 18 } } : undefined, children: [new TextRun({ text: meta.title, size: briefing ? 60 : 48, bold: briefing, color: primaryHex, font: fontName })] }));
    }
  }
  if (!verticalTitle && meta.subtitle) children.push(new Paragraph({ alignment, spacing: { after: 240 }, children: [new TextRun({ text: meta.subtitle, size: 28, color: briefing ? accentHex : textHex, font: fontName })] }));
  if (context.coverListItems?.length) {
    children.push(new Paragraph({ spacing: { before: briefing ? 1800 : 3600, after: 0 }, children: [] }));
    children.push(...coverMetadataDocx(context, 2, 6000));
  }
  if (meta.organization) children.push(new Paragraph({ alignment, spacing: { before: briefing ? 540 : 1000 }, children: [new TextRun({ text: meta.organization, size: 22, color: textHex, font: fontName })] }));
  if (meta.date) children.push(new Paragraph({ alignment, spacing: { before: meta.organization ? 180 : 540 }, children: [new TextRun({ text: meta.date, size: 22, color: textHex, font: fontName })] }));
  return children;
}

