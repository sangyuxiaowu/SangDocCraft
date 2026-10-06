import React from 'react';
import { AlignmentType, BorderStyle, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { CoverDocxRenderContext, CoverRenderContext, CoverTemplatePlugin } from '../contracts';

type MinimalHeaderOptions = { logoRight: boolean };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function details(context: CoverRenderContext): Array<[string, string]> {
  return context.coverListItems.map(({ label, value }) => [label, value]);
}

function renderThumbnail({ logoRight }: MinimalHeaderOptions): React.ReactNode {
  return <div className="h-full flex flex-col p-1 text-left">
    <div className="flex justify-between items-start border-b-2 border-blue-900 pb-1">
      <div className="w-10 h-1.5 bg-blue-900" />
      <div className={logoRight ? 'w-5 h-3 bg-slate-400' : 'w-8 h-1 bg-slate-400'} />
    </div>
    <div className="mt-3 w-12 h-2 bg-slate-800" />
    <div className="mt-1 w-8 h-1 bg-slate-400" />
    <div className="mt-2 flex gap-1"><div className="w-6 h-px bg-slate-500" /><div className="w-5 h-px bg-slate-300" /><div className="w-6 h-px bg-slate-300" /></div>
  </div>;
}

function renderPreview(context: CoverRenderContext, { logoRight }: MinimalHeaderOptions): React.ReactNode {
  const { meta, cover, style } = context;
  const color = style.primaryColor || '#1e3a8a';
  const metaDetails = details(context);
  return <div data-cover-template={logoRight ? 'minimal-logo' : 'minimal-header'} style={{ color: style.textColor, textAlign: 'left', paddingBottom: 14, marginBottom: 14, borderBottom: `2px solid ${color}`, overflowWrap: 'anywhere' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color, minWidth: 0 }}>{meta.organization}</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 4 }}>
        {logoRight
          ? cover.logoUrl && <img src={cover.logoUrl} alt="Logo" style={{ height: cover.logoHeight ?? 24, maxHeight: 'none', width: 'auto', maxWidth: 140, objectFit: 'contain' }} />
          : meta.number
            ? <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color }}>{meta.number}</div>
            : null}
        {!logoRight && meta.subtitle && <span style={{ fontSize: 10, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: '1px 6px', borderRadius: 2 }}>{meta.subtitle}</span>}
      </div>
    </div>
    {meta.title && <h1 style={{ margin: '0 0 6px', fontSize: 20, lineHeight: 1.3, fontWeight: 700, color: '#0f172a' }}>{meta.title}</h1>}
    {metaDetails.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 11, color: '#64748b' }}>
      {metaDetails.map(([label, value]) => <span key={label}><strong>{label}:</strong> {value}</span>)}
    </div>}
  </div>;
}

function renderHtml(context: CoverRenderContext, { logoRight }: MinimalHeaderOptions): string {
  const { meta, cover, style } = context;
  const color = style.primaryColor || '#1e3a8a';
  const metaDetails = details(context);
  const rightMark = logoRight && cover.logoUrl
    ? `<img src="${escapeHtml(cover.logoUrl)}" alt="Logo" style="height:${cover.logoHeight ?? 24}px;max-height:none;width:auto;max-width:140px;object-fit:contain;" />`
    : !logoRight && meta.number
      ? `<div style="font-size:12px;font-family:monospace;font-weight:600;color:${color};">${escapeHtml(meta.number)}</div>`
      : '';
  return `<div data-cover-template="${logoRight ? 'minimal-logo' : 'minimal-header'}" style="color:${style.textColor};text-align:left;padding-bottom:14px;margin-bottom:14px;border-bottom:2px solid ${color};overflow-wrap:anywhere;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:8px;">
      <div style="font-size:15px;font-weight:700;color:${color};min-width:0;">${escapeHtml(meta.organization)}</div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;gap:4px;">${rightMark}${!logoRight && meta.subtitle ? `<span style="font-size:10px;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;padding:1px 6px;border-radius:2px;">${escapeHtml(meta.subtitle)}</span>` : ''}</div>
    </div>
    ${meta.title ? `<h1 style="margin:0 0 6px;font-size:20px;line-height:1.3;font-weight:700;color:#0f172a;">${escapeHtml(meta.title)}</h1>` : ''}
    ${metaDetails.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px 16px;font-size:11px;color:#64748b;">${metaDetails.map(([label, value]) => `<span><strong>${label}:</strong> ${escapeHtml(value)}</span>`).join('')}</div>` : ''}
  </div>`;
}

async function renderDocx(context: CoverDocxRenderContext, { logoRight }: MinimalHeaderOptions): Promise<(Paragraph | Table)[]> {
  const { meta, cover, primaryHex, fontName, createImageRun } = context;
  const leftContent = meta.organization
    ? [new TextRun({ text: meta.organization, bold: true, size: 30, color: primaryHex, font: fontName })]
    : [];
  const logo = logoRight && cover.logoUrl
    ? await createImageRun(cover.logoUrl, '文档标志', undefined, cover.logoHeight ?? 24)
    : null;
  const rightContent = logo
    ? [logo]
    : !logoRight && meta.number
      ? [new TextRun({ text: meta.number, bold: true, size: 24, color: primaryHex, font: fontName })]
      : [];
  const rows: TableRow[] = [new TableRow({ children: [
    new TableCell({ width: { size: 4680, type: WidthType.DXA }, children: [new Paragraph({ children: leftContent })] }),
    new TableCell({ width: { size: 4680, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: rightContent })] }),
  ] })];
  if (!logoRight && meta.subtitle) rows.push(new TableRow({ children: [new TableCell({ columnSpan: 2, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: meta.subtitle, size: 20, color: 'B91C1C', font: fontName })] })] })] }));
  if (meta.title) rows.push(new TableRow({ children: [new TableCell({ columnSpan: 2, children: [new Paragraph({ spacing: { before: 80, after: 120 }, children: [new TextRun({ text: meta.title, bold: true, size: 40, color: '0F172A', font: fontName })] })] })] }));
  const metaDetails = details(context);
  if (metaDetails.length) rows.push(new TableRow({ children: [new TableCell({ columnSpan: 2, children: [new Paragraph({ children: metaDetails.flatMap(([label, value], index) => [
    ...(index ? [new TextRun({ text: '    ', size: 20, font: fontName })] : []),
    new TextRun({ text: `${label}: `, bold: true, size: 20, color: '64748B', font: fontName }),
    new TextRun({ text: value, size: 20, color: '64748B', font: fontName }),
  ]) })] })] }));
  return [new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 12, color: primaryHex }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows,
  })];
}

function createPlugin(id: string, name: string, description: string, options: MinimalHeaderOptions): CoverTemplatePlugin {
  return {
    id,
    name,
    description,
    standalone: false,
    inlinePageHeight: 150,
    defaultLogoHeight: 24,
    renderThumbnail: () => renderThumbnail(options),
    renderPreview: (context) => renderPreview(context, options),
    renderHtml: (context) => renderHtml(context, options),
    renderDocx: (context) => renderDocx(context, options),
  };
}

const recommendation = '正文内嵌，不独立占页；自动禁用目录生成。';

export const minimalHeaderCoverPlugin = createPlugin('minimal-header', '极简公文头', recommendation, { logoRight: false });
export const minimalLogoCoverPlugin = createPlugin('minimal-logo', '极简品牌头', recommendation, { logoRight: true });