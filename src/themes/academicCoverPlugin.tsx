import React from 'react';
import {
  AlignmentType,
  BorderStyle,
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { CoverTemplatePlugin, CoverDocxRenderContext, CoverRenderContext } from './themeRegistry';

function renderPreview(context: CoverRenderContext): React.ReactNode {
  const { meta, style, coverListItems } = context;
  return (
    <div className="flex-1 flex flex-col items-center px-8 py-4 text-center">
      <div className="w-full flex flex-col items-center gap-3 min-h-24">
        {(meta.logo || meta.logoUrl) && (
          <img src={meta.logo || meta.logoUrl} alt="Logo" className="h-16 max-w-[240px] w-auto object-contain" />
        )}
        <div className="text-xl font-bold tracking-[0.25em] leading-none" style={{ color: style.primaryColor }}>
          {meta.organization || '某某大学'}
        </div>
      </div>
      <div className="my-auto w-full space-y-4">
        <h1 className="text-3xl font-bold tracking-wide leading-relaxed" style={{ color: style.primaryColor }}>
          {meta.title || '论文题目'}
        </h1>
        {meta.subtitle && <p className="text-lg text-slate-600 leading-relaxed">{meta.subtitle}</p>}
      </div>
      <div className="w-[58%] space-y-3 text-sm text-left mb-14">
        {coverListItems.map((item, index) => (
          <div key={index} className="grid grid-cols-[6em_minmax(0,1fr)] items-end gap-2">
            <span className="font-medium tracking-wide whitespace-pre text-slate-700">{item.label}：</span>
            <span className="min-h-6 border-b border-slate-700 px-1 text-center font-medium text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
      <div className="text-sm tracking-[0.45em] text-slate-700">{meta.date || '年    月    日'}</div>
    </div>
  );
}

function renderHtml(context: CoverRenderContext): string {
  const { meta, coverListItems } = context;
  return `
    <div class="academic-cover">
      <div>
        ${(meta.logo || meta.logoUrl) ? `<img src="${meta.logo || meta.logoUrl}" class="academic-cover-logo" alt="Logo" />` : ''}
        <div class="academic-cover-organization">${meta.organization || '某某大学'}</div>
      </div>
      <div class="academic-cover-title-block">
        <div class="academic-cover-title">${meta.title || '论文题目'}</div>
        ${meta.subtitle ? `<div class="academic-cover-subtitle">${meta.subtitle}</div>` : ''}
      </div>
      <div class="academic-cover-meta">
        ${coverListItems.map((item) => `<div class="academic-cover-meta-row"><span class="academic-cover-meta-label">${item.label}：</span><span class="academic-cover-meta-value">${item.value}</span></div>`).join('')}
      </div>
      <div class="academic-cover-date">${meta.date || '年    月    日'}</div>
    </div>`;
}

async function renderDocx(context: CoverDocxRenderContext): Promise<(Paragraph | Table)[]> {
  const { meta, coverListItems, primaryHex, accentHex, textHex, fontName, docxFont, createImageRun } = context;
  const children: (Paragraph | Table)[] = [];
  const logoSource = meta.logo || meta.logoUrl;
  if (logoSource) {
    const logoRun = await createImageRun(logoSource, '文档标志', 180, 100);
    if (logoRun) {
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 160 }, children: [logoRun] }));
    }
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [new TextRun({ text: meta.organization || '某某大学', bold: true, size: 32, color: primaryHex, characterSpacing: 80, font: fontName })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1800, after: 400 },
      children: [new TextRun({ text: meta.title || '论文题目', bold: true, size: 52, color: primaryHex, font: fontName })],
    }),
  );
  if (meta.subtitle) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 1200 }, children: [new TextRun({ text: meta.subtitle, size: 28, color: accentHex, font: fontName })] }));
  }
  if (coverListItems.length > 0) {
    children.push(new Table({
      width: { size: 6000, type: WidthType.DXA },
      alignment: AlignmentType.CENTER,
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'auto' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        left: { style: BorderStyle.NONE, size: 0, color: 'auto' }, right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      },
      rows: coverListItems.map((item) => new TableRow({ children: [
        new TableCell({ width: { size: 1800, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: `${item.label}：`, bold: true, size: 22, color: primaryHex, font: fontName })] })] }),
        new TableCell({
          width: { size: 4200, type: WidthType.DXA },
          borders: { bottom: { style: BorderStyle.SINGLE, size: 4, color: primaryHex } },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.value, size: 22, color: textHex, font: docxFont })] })],
        }),
      ] })),
    }));
  }
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1000 }, children: [new TextRun({ text: meta.date || '年    月    日', size: 22, color: textHex, font: docxFont })] }));
  return children;
}

export const academicCoverPlugin: CoverTemplatePlugin = {
  id: 'academic',
  name: '🎓 学术论文',
  description: '论文题目与信息填写栏',
  renderPreview,
  renderHtml,
  renderDocx,
};