import React from 'react';
import {
  AlignmentType,
  Paragraph,
  Table,
  TextRun,
} from 'docx';
import type { CoverTemplatePlugin, CoverDocxRenderContext, CoverRenderContext } from '../contracts';
import { CoverMetadata, coverMetadataDocx, coverMetadataHtml } from '../coverMetadata';

function renderThumbnail(): React.ReactNode {
  return (
    <div className="h-full flex flex-col justify-between items-center p-1 text-center">
      <div className="w-7 h-1 border-b border-slate-700" />
      <div className="space-y-1 my-auto">
        <div className="w-12 h-1.5 bg-slate-900 mx-auto" />
        <div className="w-9 h-1 bg-slate-600 mx-auto" />
      </div>
      <div className="space-y-0.5 w-9">
        <div className="h-px bg-slate-400" />
        <div className="h-px bg-slate-400" />
        <div className="h-px bg-slate-400" />
      </div>
    </div>
  );
}

function renderPreview(context: CoverRenderContext): React.ReactNode {
  const { meta, cover, style } = context;
  const hasHeader = Boolean(cover.logoUrl || meta.organization);
  const hasTitle = Boolean(meta.title || meta.subtitle);
  return (
    <div className="flex-1 flex flex-col items-center px-8 py-4 text-center">
      {hasHeader && (
        <div className="w-full flex flex-col items-center gap-3 min-h-24">
          {cover.logoUrl && (
            <img src={cover.logoUrl} alt="Logo" style={{ height: cover.logoHeight }} className="h-16 max-w-[240px] w-auto object-contain" />
          )}
          {meta.organization && (
            <div className="text-xl font-bold tracking-[0.25em] leading-none" style={{ color: style.primaryColor }}>
              {meta.organization}
            </div>
          )}
        </div>
      )}
      {hasTitle && (
        <div className="my-auto w-full space-y-4">
          {meta.title && (
            <h1 className="text-3xl font-bold tracking-wide leading-relaxed" style={{ color: style.primaryColor }}>
              {meta.title}
            </h1>
          )}
          {meta.subtitle && <p className="text-lg text-slate-600 leading-relaxed">{meta.subtitle}</p>}
        </div>
      )}
      {Boolean(context.coverListItems?.length) && (
        <div className="w-full mb-14">
          <CoverMetadata context={context} width="58%" />
        </div>
      )}
      {meta.date && <div className="text-sm tracking-[0.45em] text-slate-700">{meta.date}</div>}
    </div>
  );
}

function renderHtml(context: CoverRenderContext): string {
  const { meta, cover } = context;
  const hasHeader = Boolean(cover.logoUrl || meta.organization);
  const hasTitle = Boolean(meta.title || meta.subtitle);
  const hasMeta = Boolean(context.coverListItems?.length);
  return `
    <div class="academic-cover">
      ${hasHeader ? `<div>
        ${cover.logoUrl ? `<img src="${cover.logoUrl}" class="academic-cover-logo"${cover.logoHeight === undefined ? '' : ` style="height:${cover.logoHeight}px;max-height:none;width:auto;"`} alt="Logo" />` : ''}
        ${meta.organization ? `<div class="academic-cover-organization">${meta.organization}</div>` : ''}
      </div>` : ''}
      ${hasTitle ? `<div class="academic-cover-title-block">
        ${meta.title ? `<div class="academic-cover-title">${meta.title}</div>` : ''}
        ${meta.subtitle ? `<div class="academic-cover-subtitle">${meta.subtitle}</div>` : ''}
      </div>` : ''}
      ${hasMeta ? `<div style="width:100%;margin-bottom:52px;">
        ${coverMetadataHtml(context, 1, '58%')}
      </div>` : ''}
      ${meta.date ? `<div class="academic-cover-date">${meta.date}</div>` : ''}
    </div>`;
}

async function renderDocx(context: CoverDocxRenderContext): Promise<(Paragraph | Table)[]> {
  const { meta, cover, primaryHex, accentHex, textHex, fontName, docxFont, createImageRun } = context;
  const children: (Paragraph | Table)[] = [];
  const logoSource = cover.logoUrl;
  if (logoSource) {
    const logoRun = cover.logoHeight === undefined
      ? await createImageRun(logoSource, '文档标志', 180, 100)
      : await createImageRun(logoSource, '文档标志', undefined, cover.logoHeight);
    if (logoRun) {
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 160 }, children: [logoRun] }));
    }
  }
  if (meta.organization) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [new TextRun({ text: meta.organization, bold: true, size: 32, color: primaryHex, characterSpacing: 80, font: fontName })],
      }),
    );
  }
  if (meta.title) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1800, after: 400 },
        children: [new TextRun({ text: meta.title, bold: true, size: 52, color: primaryHex, font: fontName })],
      }),
    );
  }
  if (meta.subtitle) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 1200 }, children: [new TextRun({ text: meta.subtitle, size: 28, color: accentHex, font: fontName })] }));
  }
  children.push(...coverMetadataDocx(context, 1, 6000));
  if (meta.date) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1000 }, children: [new TextRun({ text: meta.date, size: 22, color: textHex, font: docxFont })] }));
  }
  return children;
}

export const academicCoverPlugin: CoverTemplatePlugin = {
  id: 'academic',
  name: '🎓 学术论文',
  description: '论文题目与信息填写栏',
  defaultLogoHeight: 64,
  defaultCoverListColumns: 1,
  renderThumbnail,
  renderPreview,
  renderHtml,
  renderDocx,
};