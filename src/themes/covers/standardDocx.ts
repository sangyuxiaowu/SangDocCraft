import { AlignmentType, BorderStyle, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { CoverDocxRenderContext } from '../contracts';

export async function renderStandardDocx(context: CoverDocxRenderContext): Promise<(Paragraph | Table)[]> {
  const { meta, cover, coverListItems, primaryHex, accentHex, textHex, fontName, createImageRun } = context;
  const children: (Paragraph | Table)[] = [];
  const logoSource = cover.logoUrl;
  if (logoSource) {
    const logo = cover.logoHeight === undefined
      ? await createImageRun(logoSource, '文档标志')
      : await createImageRun(logoSource, '文档标志', undefined, cover.logoHeight);
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
      new TableCell({ width: { size: 2500, type: WidthType.DXA }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${item.label}${item.label.includes(':') || item.label.includes('：') ? '' : '：'}`, bold: true, size: 22, color: primaryHex, font: fontName })] })] }),
      new TableCell({ width: { size: 5500, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: item.value, size: 22, color: textHex, font: fontName })] })] }),
    ] })),
  }));
  return children;
}