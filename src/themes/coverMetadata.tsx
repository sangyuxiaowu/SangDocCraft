import React from 'react';
import { AlignmentType, BorderStyle, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { CoverDocxRenderContext, CoverRenderContext } from './contracts';

const labelText = (label: string) => `${label}${/[:：]/.test(label) ? '' : '：'}`;

function metadataStyle(columns: 1 | 2, width: string): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: '12px 28px', width: columns === 2 ? '80%' : width, maxWidth: columns === 2 ? '80%' : '44%', margin: '0 auto', fontSize: 14, textAlign: 'left' };
}

const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 6em) minmax(0, 1fr)', alignItems: 'end', gap: 8, minWidth: 0 };
const labelStyle: React.CSSProperties = { color: '#334155', fontWeight: 500, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
const valueStyle: React.CSSProperties = { minHeight: 24, borderBottom: '1px solid #334155', padding: '0 4px', textAlign: 'center', color: '#0f172a', fontWeight: 500, overflowWrap: 'anywhere' };

export function CoverMetadata({ context, defaultColumns = 1, width = '52%' }: { context: CoverRenderContext; defaultColumns?: 1 | 2; width?: string }) {
  const columns = context.meta.coverListColumns ?? defaultColumns;
  return <div data-cover-columns={columns} style={metadataStyle(columns, width)}>
    {context.coverListItems.map((item, index) => <div key={index} style={rowStyle}>
      <span style={labelStyle}>{labelText(item.label)}</span>
      <span style={valueStyle}>{item.value}</span>
    </div>)}
  </div>;
}

export function coverMetadataHtml(context: CoverRenderContext, defaultColumns: 1 | 2 = 1, width = '52%'): string {
  const columns = context.meta.coverListColumns ?? defaultColumns;
  return `<div data-cover-columns="${columns}" style="display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:12px 28px;width:${columns === 2 ? '80%' : width};max-width:${columns === 2 ? '80%' : '44%'};margin:0 auto;font-size:14px;text-align:left;">${context.coverListItems.map((item) => `<div style="display:grid;grid-template-columns:minmax(0,6em) minmax(0,1fr);align-items:end;gap:8px;min-width:0;"><span style="color:#334155;font-weight:500;white-space:pre-wrap;overflow-wrap:anywhere;">${labelText(item.label)}</span><span style="min-height:24px;border-bottom:1px solid #334155;padding:0 4px;text-align:center;color:#0f172a;font-weight:500;overflow-wrap:anywhere;">${item.value}</span></div>`).join('')}</div>`;
}

export function coverMetadataDocx(context: CoverDocxRenderContext, defaultColumns: 1 | 2 = 1, singleWidth = 5200): Table[] {
  const { meta, coverListItems, primaryHex, textHex, fontName, docxFont } = context;
  if (!coverListItems.length) return [];
  const columns = meta.coverListColumns ?? defaultColumns;
  const width = columns === 2 ? 7680 : Math.min(singleWidth, 4400);
  const fieldWidth = columns === 2 ? (width - 400) / 2 : width;
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'auto' };
  const rows: TableRow[] = [];
  for (let index = 0; index < coverListItems.length; index += columns) {
    const cells: TableCell[] = [];
    for (let column = 0; column < columns; column++) {
      if (column > 0) cells.push(new TableCell({ width: { size: 400, type: WidthType.DXA }, children: [new Paragraph('')] }));
      const item = coverListItems[index + column];
      cells.push(
        new TableCell({ width: { size: 1800, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: item ? labelText(item.label) : '', bold: true, size: 22, color: primaryHex, font: fontName })] })] }),
        new TableCell({ width: { size: fieldWidth - 1800, type: WidthType.DXA }, borders: { bottom: item ? { style: BorderStyle.SINGLE, size: 4, color: primaryHex } : noBorder }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item?.value ?? '', size: 22, color: textHex, font: docxFont })] })] }),
      );
    }
    rows.push(new TableRow({ cantSplit: true, children: cells }));
  }
  return [new Table({ width: { size: width, type: WidthType.DXA }, alignment: AlignmentType.CENTER, columnWidths: columns === 2 ? [1800, fieldWidth - 1800, 400, 1800, fieldWidth - 1800] : [1800, fieldWidth - 1800], borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder }, rows })];
}