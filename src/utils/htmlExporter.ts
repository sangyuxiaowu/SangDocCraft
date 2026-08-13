import { marked } from 'marked';
import { DocumentTheme, FooterConfig, DocumentMeta } from '../types';
import { getEffectiveMeta, parseFrontmatter, parseTableOfContents, getFooterSlots, formatPageNumber, splitContentByPages, getTocChunks, paginateContentByDom, preprocessMarkdownCaptions, postProcessRenderedHtml } from './markdownParser';

function renderFooterHtml(pageNum: number, totalPages: number, footer: FooterConfig, meta: DocumentMeta): string {
  if (!footer.show) return '';
  const slots = getFooterSlots(pageNum, totalPages, footer, meta);
  return `
    <div class="doc-footer">
      <span class="footer-left">${slots.left}</span>
      <span class="footer-center">${slots.center}</span>
      <span class="footer-right">${slots.right}</span>
    </div>
  `;
}

export function generateStandaloneHtml(markdownText: string, theme: DocumentTheme): string {
  const { header, footer, toc, style } = theme;
  const meta = getEffectiveMeta(theme.meta, markdownText);
  const parsedMarkdown = parseFrontmatter(markdownText);
  const bodyText = parsedMarkdown.body || markdownText;

  // Calculate TOC items with page numbers
  const tocItems = parseTableOfContents(markdownText, toc.maxDepth || 3, meta, toc.show, style.h1PageBreak);
  const tocChunks = toc.show ? getTocChunks(tocItems) : [];

  // Font Family Stack for exporter
  const fontStack = style.fontFamily === 'serif' ? 'SimSun, "Songti SC", STSong, "Times New Roman", serif' :
                    style.fontFamily === 'kaiti' ? 'KaiTi, "Kaiti SC", STKaiti, serif' :
                    style.fontFamily === 'heiti' ? 'SimHei, "Heiti SC", STHeiti, sans-serif' :
                    style.fontFamily === 'mono' ? 'Consolas, "Fira Code", Monaco, monospace' :
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif';

  // Split markdown body using dynamic DOM measurement algorithm
  const rawContentPages = paginateContentByDom(bodyText, {
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    fontFamily: fontStack,
    primaryColor: style.primaryColor,
    accentColor: style.accentColor,
    textColor: style.textColor,
    h1PageBreak: style.h1PageBreak,
    headerShow: header.show,
    footerShow: footer.show,
  });

  // Calculate total pages
  const coverCount = meta.showCover ? 1 : 0;
  const tocCount = tocChunks.length;
  const contentCount = rawContentPages.length;
  const totalPages = coverCount + tocCount + contentCount;

  let pageNumCounter = 1;
  const coverPageNum = meta.showCover ? pageNumCounter++ : 0;

  const coverListItems = (meta.coverlist && meta.coverlist.length > 0)
    ? meta.coverlist
    : [
        { label: '项目名称', value: meta.projectName },
        { label: '文档版本', value: meta.version },
        { label: '撰写团队', value: meta.author },
        { label: '所属部门', value: meta.department },
        { label: '所属机构', value: meta.organization },
        { label: '交付日期', value: meta.date },
      ].filter(item => !!item.value);

  const renderMetaTableRows = () => {
    return coverListItems.map(item => `
      <tr>
        <td class="label">${item.label}${item.label.includes(':') || item.label.includes('：') ? '' : '：'}</td>
        <td class="value">${item.value}</td>
      </tr>
    `).join('');
  };

  const renderModernMetaGrid = () => {
    return coverListItems.map(item => `
      <div class="grid-item">
        <div class="grid-item-label">${item.label}</div>
        <div class="grid-item-value">${item.value}</div>
      </div>
    `).join('');
  };

  const renderSpecMetaGrid = () => {
    return coverListItems.map(item => `
      <div class="spec-grid-item">
        <span class="label">${item.label}${item.label.includes(':') || item.label.includes('：') ? '' : '：'}</span>
        <span class="value">${item.value}</span>
      </div>
    `).join('');
  };

  const renderCoverMetaCards = () => {
    return coverListItems.map(item => {
      const match = item.label.match(/^(\p{Extended_Pictographic}+(?:\uFE0F|\u200D\p{Extended_Pictographic}+)*)\s*(.*)/u);
      const emoji = match ? match[1] : null;
      const cleanLabel = match && match[2] ? match[2].trim() : (emoji ? item.label.replace(emoji, '').trim() : item.label);
      return `
        <div class="creative-card">
          ${emoji ? `<span class="emoji">${emoji}</span>` : ''}
          <div style="overflow: hidden; width: 100%;">
            <div class="label">${cleanLabel || item.label}</div>
            <div class="value">${item.value}</div>
          </div>
        </div>
      `;
    }).join('');
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${meta.title || '设计交付文档'}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    
    :root {
      --primary-color: ${style.primaryColor};
      --accent-color: ${style.accentColor};
      --text-color: ${style.textColor};
      --bg-color: ${style.backgroundColor};
      --font-family: ${fontStack};
      --base-font-size: ${style.fontSize}px;
      --line-height: ${style.lineHeight};
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      font-family: var(--font-family);
      font-size: var(--base-font-size);
      line-height: var(--line-height);
      color: var(--text-color);
      background-color: #f1f5f9;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      padding: 20px 0;
    }

    /* A4 Page Container */
    .a4-page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      box-sizing: border-box;
      margin: 0 auto 30px auto;
      background: #ffffff;
      padding: 20mm 15mm 20mm 15mm;
      box-shadow: 0 10px 25px rgba(0,0,0,0.12);
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }

    /* Cover Page */
    .cover-page {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
      flex: 1;
      text-align: center;
      padding: 10px 0;
      box-sizing: border-box;
      overflow: hidden;
    }
    .cover-title {
      font-size: 32px;
      font-weight: 800;
      color: var(--primary-color);
      margin-bottom: 12px;
      line-height: 1.3;
    }
    .cover-subtitle {
      font-size: 18px;
      color: var(--accent-color);
      margin-bottom: 20px;
    }
    .cover-divider {
      width: 80px;
      height: 4px;
      background-color: var(--accent-color);
      margin: 0 auto 30px auto;
      border-radius: 2px;
    }

    /* Meta Table & Grids */
    .cover-meta-table {
      width: 80%;
      max-width: 480px;
      margin: 24px auto;
      border-collapse: collapse;
      font-size: 12px;
    }
    .cover-meta-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .cover-meta-table td.label {
      font-weight: 600;
      color: #64748b;
      text-align: right;
      width: 35%;
    }
    .cover-meta-table td.value {
      font-weight: 600;
      color: #1e293b;
      text-align: left;
      width: 65%;
    }

    .cover-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 24px;
      background: #f8fafc;
      padding: 16px;
      margin: 24px 0;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      font-size: 12px;
      text-align: left;
    }
    .cover-meta-grid .grid-item-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #94a3b8;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .cover-meta-grid .grid-item-value {
      font-weight: 600;
      color: #1e293b;
    }

    .spec-meta-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 16px;
      background: #f8fafc;
      padding: 14px;
      margin: 24px 0;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      font-size: 12px;
      text-align: left;
    }
    .spec-meta-box .spec-grid-item {
      display: flex;
      gap: 6px;
    }
    .spec-meta-box .spec-grid-item .label {
      color: #64748b;
      font-weight: 600;
    }
    .spec-meta-box .spec-grid-item .value {
      color: #0f172a;
      font-weight: 600;
    }

    .creative-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 20px 0;
      text-align: left;
    }
    .creative-grid .creative-card {
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .creative-grid .creative-card .emoji {
      font-size: 18px;
    }
    .creative-grid .creative-card .label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #94a3b8;
      letter-spacing: 0.5px;
    }
    .creative-grid .creative-card .value {
      font-size: 12px;
      font-weight: 700;
      color: #1e293b;
    }

    /* Header & Footer */
    .doc-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #64748b;
      padding-bottom: 6px;
      margin-bottom: 16px;
      border-bottom: ${header.lineStyle === 'none' ? 'none' : header.lineStyle === 'double' ? '3px double ' + style.accentColor : '1px solid ' + style.accentColor};
      shrink: 0;
    }
    .doc-footer {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #64748b;
      padding-top: 6px;
      margin-top: 16px;
      border-top: 1px solid #e2e8f0;
      shrink: 0;
    }
    .doc-footer .footer-left {
      text-align: left;
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .doc-footer .footer-center {
      text-align: center;
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: monospace;
    }
    .doc-footer .footer-right {
      text-align: right;
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: monospace;
    }

    /* Content Area */
    .markdown-content {
      flex: 1;
    }

    h1, h2, h3, h4, h5, h6 {
      color: var(--primary-color);
      margin-top: 1.2em;
      margin-bottom: 0.5em;
      font-weight: 700;
      page-break-after: avoid;
    }
    h1 {
      font-size: 22px;
      border-bottom: 2px solid var(--accent-color);
      padding-bottom: 6px;
    }
    h2 {
      font-size: 18px;
      border-left: 4px solid var(--accent-color);
      padding-left: 10px;
    }
    h3 {
      font-size: 15px;
    }
    p {
      margin-bottom: 0.8em;
      text-indent: ${style.indentParagraph ? '2em' : '0'};
    }
    p.p-continuation, .p-continuation p, blockquote p, li p, table p {
      text-indent: 0 !important;
    }
    blockquote {
      border-left: 4px solid var(--accent-color);
      background: #f8fafc;
      padding: 10px 16px;
      margin: 1em 0;
      color: #475569;
      font-style: italic;
    }
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 12px 16px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: Consolas, monospace;
      font-size: 12px;
      margin: 1em 0;
    }
    code {
      background: #f1f5f9;
      color: #0f172a;
      padding: 2px 5px;
      border-radius: 4px;
      font-family: Consolas, monospace;
      font-size: 0.9em;
    }
    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
    }
    ul, ol {
      margin: 0.8em 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 0.3em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.2em 0;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background-color: var(--primary-color);
      color: #ffffff;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }

    /* Table of Contents Styling */
    .toc-page {
      display: flex;
      flex-direction: column;
      flex: 1;
      padding: 10px 0;
    }
    .toc-title {
      font-size: 22px;
      font-weight: 800;
      color: var(--primary-color);
      border-bottom: 2px solid var(--accent-color);
      padding-bottom: 8px;
      margin-bottom: 24px;
    }
    .toc-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .toc-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      text-decoration: none;
      color: inherit;
      transition: color 0.15s ease;
    }
    .toc-item:hover {
      color: var(--accent-color);
    }
    .toc-item.level-1 {
      font-weight: bold;
      font-size: 14px;
      color: var(--primary-color);
    }
    .toc-item.level-2 {
      padding-left: 20px;
      color: var(--text-color);
    }
    .toc-item.level-3 {
      padding-left: 40px;
      color: #64748b;
    }
    .toc-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 80%;
    }
    .toc-leader {
      flex: 1;
      margin: 0 10px;
      height: 1px;
      border-bottom: 1px dotted #cbd5e1;
    }
    .toc-leader.dashes {
      border-bottom-style: dashed;
    }
    .toc-leader.none {
      border-bottom: none;
    }
    .toc-page-num {
      font-family: monospace;
      color: #475569;
      font-weight: 700;
      font-size: 12px;
    }

    /* Figures, Captions & Image Borders */
    .doc-image-figure {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 1.2em auto;
    }
    .doc-image {
      max-width: 100%;
      height: auto;
      display: block;
    }
    .doc-img-border-none { border: none; }
    .doc-img-border-solid { border: 1px solid #cbd5e1; }
    .doc-img-border-subtle { border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-radius: 4px; }
    .doc-img-border-shadow { box-shadow: 0 4px 14px rgba(0,0,0,0.12); border-radius: 6px; }
    .doc-img-border-card { background-color: #f8fafc; padding: 8px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); }
    .doc-img-border-rounded { border-radius: 12px; border: 1px solid #cbd5e1; }
    .doc-image-caption { margin-top: 6px; font-size: 0.85em; color: #64748b; font-weight: 600; line-height: 1.4; }
    .doc-table-caption { margin-top: 4px; margin-bottom: 6px; font-size: 0.88em; color: #475569; font-weight: 600; line-height: 1.4; }

    /* Print Styles for PDF Export */
    @media print {
      @page {
        size: A4 portrait;
        margin: 0 !important;
      }

      html, body {
        background: #ffffff !important;
        color: #000000 !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 210mm !important;
        height: auto !important;
      }

      body {
        padding: 0 !important;
      }

      .a4-page {
        width: 210mm !important;
        height: 297mm !important;
        max-height: 297mm !important;
        box-sizing: border-box !important;
        box-shadow: none !important;
        border: none !important;
        margin: 0 !important;
        padding: 20mm 15mm 20mm 15mm !important;
        background: #ffffff !important;
        page-break-before: always !important;
        break-before: page !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        overflow: hidden !important;
      }

      .a4-page:first-child {
        page-break-before: auto !important;
        break-before: auto !important;
      }

      .cover-page-wrapper, .toc-page-wrapper, .content-page-wrapper {
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid !important;
        break-after: avoid !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      table, tr, img, pre, blockquote, .cover-meta-table {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .doc-header, .doc-footer {
        display: flex !important;
      }
    }
  </style>
</head>
<body>
  ${meta.showCover ? `
  <div class="a4-page cover-page-wrapper">
    ${header.show && !header.hideOnCover ? `
    <div class="doc-header">
      <span>${header.leftText || meta.projectName || ''}</span>
      <span>${header.rightText || meta.title || ''}</span>
    </div>
    ` : ''}

    <div class="cover-page cover-style-${meta.coverStyle || 'enterprise'}">
      ${meta.coverStyle === 'modern' ? `
        <div style="border-left: 4px solid var(--accent-color); padding-left: 20px; flex: 1; height: 100%; min-height: 0; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; text-align: left;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              ${(meta.logo || meta.logoUrl) ? `<img src="${meta.logo || meta.logoUrl}" style="max-height: 28px; object-fit: contain;" alt="Logo" />` : ''}
              <span style="font-size: 12px; font-weight: bold; color: var(--primary-color); background: rgba(0,0,0,0.05); padding: 4px 12px; border-radius: 4px;">${meta.organization || 'SPECIFICATION'}</span>
            </div>
            ${(meta.number || meta.version) ? `<span style="background: var(--accent-color); color: #fff; padding: 3px 12px; border-radius: 9999px; font-size: 11px; font-family: monospace; font-weight: bold;">${meta.number || meta.version}</span>` : ''}
          </div>
          <div style="margin: auto 0; padding: 20px 0;">
            <div class="cover-title" style="text-align: left; font-size: 36px; font-weight: 900;">${meta.title || '设计交付文档'}</div>
            ${meta.subtitle ? `<div class="cover-subtitle" style="text-align: left; font-size: 18px;">${meta.subtitle}</div>` : ''}
            <div style="height: 5px; width: 80px; background: var(--accent-color); border-radius: 3px; margin-top: 15px;"></div>
          </div>
          <div class="cover-meta-grid">
            ${renderModernMetaGrid()}
          </div>
        </div>
      ` : meta.coverStyle === 'spec' ? `
        <div style="border: 2px double var(--primary-color); padding: 20px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
          <div style="text-align: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px;">
            ${(meta.logo || meta.logoUrl) ? `<img src="${meta.logo || meta.logoUrl}" style="max-height: 28px; object-fit: contain; margin: 0 auto 6px auto; display: block;" alt="Logo" />` : ''}
            <div style="font-weight: bold; font-size: 12px; color: var(--primary-color); letter-spacing: 2px; text-transform: uppercase;">${meta.organization || '标准交付文件'}</div>
          </div>
          <div style="text-align: center; margin: auto 0; padding: 20px 0;">
            ${(meta.number || meta.version) ? `<div style="font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 8px; font-family: monospace; letter-spacing: 1px;">文档编号：${meta.number || 'SPEC-' + meta.version}</div>` : ''}
            <div class="cover-title" style="font-size: 32px;">${meta.title || '规范设计交付文档'}</div>
            ${meta.subtitle ? `<div class="cover-subtitle" style="font-size: 16px;">${meta.subtitle}</div>` : ''}
          </div>
          <div class="spec-meta-box">
            ${renderSpecMetaGrid()}
          </div>
        </div>
      ` : meta.coverStyle === 'minimal' ? `
        <div style="text-align: left; flex: 1; height: 100%; min-height: 0; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 11px; font-family: monospace; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase;">${meta.organization || 'DOCUMENTATION'}</div>
            ${(meta.logo || meta.logoUrl) ? `<img src="${meta.logo || meta.logoUrl}" style="max-height: 24px; object-fit: contain;" alt="Logo" />` : ''}
          </div>
          <div style="margin: auto 0; padding: 20px 0;">
            ${meta.number ? `<div style="font-size: 11px; font-family: monospace; color: #94a3b8; margin-bottom: 8px;">NO. ${meta.number}</div>` : ''}
            <div class="cover-title" style="text-align: left; font-size: 40px; font-weight: 300;">${meta.title || '设计交付文档'}</div>
            ${meta.subtitle ? `<div class="cover-subtitle" style="text-align: left; font-size: 16px; color: #64748b;">${meta.subtitle}</div>` : ''}
            <div style="height: 1px; width: 50px; background: #cbd5e1; margin-top: 20px;"></div>
          </div>
          <div style="font-size: 11px; color: #64748b; font-family: monospace; border-top: 1px solid #e2e8f0; padding-top: 14px; display: flex; flex-direction: column; gap: 4px;">
            ${coverListItems.map(item => `<div><span style="color: #94a3b8;">${item.label} /</span> ${item.value}</div>`).join('')}
          </div>
        </div>
      ` : meta.coverStyle === 'creative' ? `
        <div style="flex: 1; height: 100%; min-height: 0; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
          <div style="background: linear-gradient(135deg, var(--primary-color), var(--accent-color)); color: #fff; padding: 28px 24px; border-radius: 16px; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9;">${meta.organization || 'CREATIVE SPEC'}</div>
              ${(meta.logo || meta.logoUrl) ? `<img src="${meta.logo || meta.logoUrl}" style="max-height: 24px; filter: brightness(0) invert(1);" alt="Logo" />` : ''}
            </div>
            ${meta.number ? `<div style="font-size: 11px; font-family: monospace; opacity: 0.8; margin-bottom: 4px;">NO. ${meta.number}</div>` : ''}
            <div style="font-size: 30px; font-weight: 800; line-height: 1.2;">${meta.title || '设计交付文档'}</div>
            ${meta.subtitle ? `<div style="font-size: 14px; margin-top: 8px; opacity: 0.9;">${meta.subtitle}</div>` : ''}
          </div>
          <div class="creative-grid">
            ${renderCoverMetaCards()}
          </div>
          <div style="text-align: center; font-size: 10px; color: #94a3b8; letter-spacing: 2px; font-weight: bold;">DOC CRAFT CREATIVE SPECIFICATION</div>
        </div>
      ` : `
        <div>
          ${(meta.logo || meta.logoUrl) ? `<img src="${meta.logo || meta.logoUrl}" style="max-height: 36px; margin: 0 auto 10px auto; display: block;" alt="Logo" />` : ''}
          <div style="margin-bottom: 10px;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; padding: 4px 14px; border-radius: 9999px; display: inline-block; color: var(--accent-color); background-color: rgba(37, 99, 235, 0.08); border: 1px solid rgba(37, 99, 235, 0.25);">
              ${meta.organization || '标准交付文档'}
            </span>
          </div>
          ${meta.number ? `<div style="font-size: 11px; font-family: monospace; color: #94a3b8; margin-top: 6px;">NO. ${meta.number}</div>` : ''}
        </div>
        <div style="margin: auto 0; padding: 20px 0;">
          <div class="cover-title">${meta.title || '设计交付文档'}</div>
          ${meta.subtitle ? `<div class="cover-subtitle">${meta.subtitle}</div>` : ''}
          <div class="cover-divider"></div>
          <table class="cover-meta-table">
            ${renderMetaTableRows()}
          </table>
        </div>
        <div></div>
      `}
    </div>

    ${footer.show && !footer.hideOnCover ? renderFooterHtml(coverPageNum, totalPages, footer, meta) : ''}
  </div>
  ` : ''}

  ${toc.show ? tocChunks.map((chunk, chunkIdx) => {
    const tocPageNum = (meta.showCover ? 1 : 0) + chunkIdx + 1;
    return `
  <div class="a4-page toc-page-wrapper">
    ${header.show ? `
    <div class="doc-header">
      <span>${header.leftText || meta.projectName || ''}</span>
      <span>${header.rightText || meta.title || ''}</span>
    </div>
    ` : ''}

    <div class="toc-page">
      <h2 class="toc-title">
        ${toc.title || '目 录'}
        ${tocChunks.length > 1 ? `<span style="font-size: 13px; font-weight: normal; color: #64748b; margin-left: 8px;">(${chunkIdx + 1}/${tocChunks.length})</span>` : ''}
      </h2>
      ${chunk.length === 0 ? `
        <p style="color: #94a3b8; font-style: italic; font-size: 13px;">尚未在文档中发现标题项...</p>
      ` : `
        <div class="toc-list">
          ${chunk.map((item) => `
            <a href="#${item.id}" class="toc-item level-${item.level}">
              <span class="toc-text">${item.text}</span>
              <span class="toc-leader ${toc.leaderStyle || 'dots'}"></span>
              <span class="toc-page-num">${item.pageNumber ?? 1}</span>
            </a>
          `).join('')}
        </div>
      `}
    </div>

    ${footer.show ? renderFooterHtml(tocPageNum, totalPages, footer, meta) : ''}
  </div>
  `;
  }).join('') : ''}

  ${(() => {
    const exportCounters = { imgCount: 0, tableCount: 0 };
    return rawContentPages.map((pageMd, idx) => {
      const pageNum = (meta.showCover ? 1 : 0) + (toc.show ? tocChunks.length : 0) + idx + 1;
      const preprocessed = preprocessMarkdownCaptions(pageMd || '');
      const rawHtml = marked.parse(preprocessed) as string;
      const pageHtml = postProcessRenderedHtml(rawHtml, style, exportCounters);

      return `
  <div class="a4-page content-page-wrapper">
    ${header.show ? `
    <div class="doc-header">
      <div style="display: flex; align-items: center; gap: 8px;">
        ${header.logoUrl ? `<img src="${header.logoUrl}" style="height: ${header.logoHeight || 20}px; object-fit: contain;" alt="Header Logo" />` : ''}
        <span>${header.leftText || meta.projectName || ''}</span>
      </div>
      <span>${header.rightText || meta.title || ''}</span>
    </div>
    ` : ''}

    <div class="markdown-content">
      ${pageHtml}
    </div>

    ${footer.show ? renderFooterHtml(pageNum, totalPages, footer, meta) : ''}
  </div>
  `;
    }).join('');
  })()}
</body>
</html>`;
}

export function exportToHtmlFile(markdownText: string, theme: DocumentTheme, filename?: string): void {
  const htmlContent = generateStandaloneHtml(markdownText, theme);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const outName = filename || `${theme.meta.title || '交付文档'}_${theme.meta.version || 'v1.0'}.html`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = outName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
