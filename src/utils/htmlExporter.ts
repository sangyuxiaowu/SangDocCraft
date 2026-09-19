import { marked } from 'marked';
import { DocumentTheme, FooterConfig, DocumentMeta } from '../types';
import { getFooterSlots, getHeadingText, getTocTitleStyleObject, styleObjectToCss } from './documentStructure';
import { extractTocHeadings, assignTocPageNumbers, paginateTocItemsByDom, buildTocItemHtml, buildTocTitleHtml, buildTocPageIndicator, paginateContentByDom, preprocessMarkdownCaptions, postProcessRenderedHtml, getDocumentFontStack, getMarkdownBodyCss } from './markdownParser';
import { fetchImageBinary } from './tauriHelper';
import { getCoverTemplate } from '../themes/themeRegistry';
import { renderMermaidInHtml } from './mermaidRenderer';
import { getTocTitleCss } from './markdownParser';

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

function addTocAnchors(html: string, maxDepth: number, anchorIndex: { value: number }): string {
  return html.replace(/<h([1-6])([^>]*)>/gi, (match, level: string, attributes: string) => {
    if (Number(level) > maxDepth) return match;
    anchorIndex.value += 1;
    return `<h${level}${attributes} id="heading-${anchorIndex.value}">`;
  });
}

function addHeadingNumbers(html: string, headingNumbering: DocumentTheme['toc']['headingNumbering'], counters: number[]): string {
  return html.replace(/<h([1-4])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level: string, attributes: string, content: string) => {
    const prefix = getHeadingText('', Number(level), counters, headingNumbering).trim();
    return `<h${level}${attributes}>${prefix ? `${prefix} ` : ''}${content}</h${level}>`;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function inlineImagesAsDataUris(html: string): Promise<string> {
  const imageSources = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
  const uniqueSources = [...new Set(imageSources.filter((src) => !src.startsWith('data:')))];
  const replacements = new Map<string, string>();

  await Promise.all(uniqueSources.map(async (source) => {
    try {
      const { data, contentType } = await fetchImageBinary(source);
      replacements.set(source, await blobToDataUrl(new Blob([data], { type: contentType })));
    } catch (error) {
      console.warn('HTML image export failed:', source, error);
    }
  }));

  return html.replace(/(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi, (match, prefix: string, source: string, suffix: string) => {
    return replacements.has(source) ? `${prefix}${replacements.get(source)}${suffix}` : match;
  });
}

export function generateStandaloneHtml(
  markdownText: string,
  theme: DocumentTheme,
  mermaidHeights: Record<string, number> = {},
): string {
  const { header, footer, toc, style } = theme;
  const meta = theme.meta;
  const coverTemplate = getCoverTemplate(meta.coverStyle);
  const coverStyle = coverTemplate.id;

  const fontStack = getDocumentFontStack(style);
  const bulletChar = style.bulletStyle === 'square' ? '■' :
    style.bulletStyle === 'checkmark' ? '✓' :
    style.bulletStyle === 'arrow' ? '▸' : '•';

  // Split markdown body using dynamic DOM measurement algorithm
  const rawContentPages = paginateContentByDom(markdownText, {
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    fontFamily: fontStack,
    primaryColor: style.primaryColor,
    accentColor: style.accentColor,
    textColor: style.textColor,
    h1PageBreak: style.h1PageBreak,
    headerShow: header.show,
    footerShow: footer.show,
    style,
    mermaidHeights,
  });

  // Build TOC page numbers from the exact pages used by the export.
  // 目录分页与预览共用同一套「真实高度自适应」测量，保证页码一致。
  const tocHeadings = toc.show
    ? extractTocHeadings(rawContentPages, toc.maxDepth || 3, toc.headingNumbering)
    : [];
  const tocChunks = toc.show
    ? paginateTocItemsByDom(tocHeadings, {
        toc,
        style,
        headerShow: header.show,
        footerShow: footer.show,
        fontFamily: fontStack,
        coverPageCount: meta.showCover ? 1 : 0,
        contentPageCount: rawContentPages.length,
      })
    : [];
  const tocPageCount = tocChunks.length;
  const firstContentPageNum = (meta.showCover ? 1 : 0) + (toc.show ? tocPageCount : 0) + 1;
  const tocPages = tocChunks.map((chunk) => assignTocPageNumbers(chunk, firstContentPageNum));

  // Calculate total pages
  const coverCount = meta.showCover ? 1 : 0;
  const tocCount = tocPages.length;
  const contentCount = rawContentPages.length;
  const totalPages = coverCount + tocCount + contentCount;

  let pageNumCounter = 1;
  const coverPageNum = meta.showCover ? pageNumCounter++ : 0;

  const coverListItems = (meta.coverlist && meta.coverlist.length > 0)
    ? meta.coverlist
    : [
        { label: '撰写团队', value: meta.author },
        { label: '所属部门', value: meta.department },
      ].filter(item => !!item.value);

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
      width: 55%;
      max-width: 440px;
      margin: 0 auto;
      border-collapse: collapse;
      font-size: 11px;
    }
    .cover-meta-table td {
      padding: 8px 12px;
      border: none !important;
      border-bottom: 1px solid #f1f5f9 !important;
      background: transparent !important;
    }
    .cover-meta-table tr,
    .cover-meta-table tr:nth-child(even) {
      background: transparent;
    }
    .cover-meta-table td.label {
      font-weight: 600;
      color: #64748b;
      text-align: right;
      width: 33.333333%;
    }
    .cover-meta-table td.value {
      font-weight: 500;
      color: #1e293b;
      text-align: left;
      width: 66.666667%;
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

    .academic-cover {
      flex: 1;
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 10px 32px;
    }
    .academic-cover-logo {
      max-height: 64px;
      max-width: 240px;
      object-fit: contain;
      display: block;
      margin: 0 auto 12px;
    }
    .academic-cover-organization {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 5px;
      color: var(--primary-color);
    }
    .academic-cover-title-block {
      width: 100%;
      margin: auto 0;
    }
    .academic-cover-title {
      font-size: 30px;
      line-height: 1.6;
      font-weight: 700;
      letter-spacing: 1px;
      color: var(--primary-color);
    }
    .academic-cover-subtitle {
      margin-top: 12px;
      font-size: 18px;
      line-height: 1.6;
      color: #475569;
    }
    .academic-cover-meta {
      width: 58%;
      margin: 0 auto 52px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 14px;
      text-align: left;
    }
    .academic-cover-meta-row {
      display: grid;
      grid-template-columns: 6em minmax(0, 1fr);
      align-items: end;
      gap: 8px;
    }
    .academic-cover-meta-label {
      color: #334155;
      font-weight: 500;
      white-space: pre;
    }
    .academic-cover-meta-value {
      min-height: 24px;
      padding: 0 4px;
      border-bottom: 1px solid #334155;
      color: #0f172a;
      font-weight: 500;
      text-align: center;
    }
    .enterprise-cover-meta {
      width: 52%;
      margin: 0 auto 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 14px;
      text-align: left;
    }
    .enterprise-cover-meta-row {
      display: grid;
      grid-template-columns: 6em minmax(0, 1fr);
      align-items: end;
      gap: 8px;
    }
    .enterprise-cover-meta-label {
      color: #334155;
      font-weight: 500;
      white-space: pre;
    }
    .enterprise-cover-meta-value {
      min-height: 24px;
      padding: 0 4px;
      border-bottom: 1px solid #334155;
      color: #0f172a;
      font-weight: 500;
      text-align: center;
    }
    .academic-cover-date {
      padding-left: 6px;
      font-size: 14px;
      letter-spacing: 6px;
      color: #334155;
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
      border-bottom: ${header.lineStyle === 'none' ? 'none' :
        header.lineStyle === 'double' ? `3px double ${style.accentColor}` :
        header.lineStyle === 'accent' ? `2px solid ${style.accentColor}` :
        '1px solid #cbd5e1'};
      flex-shrink: 0;
    }
    .doc-header-left {
      transition: margin-left 0.1s ease;
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
      flex-shrink: 0;
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
    .markdown-content h1 {
      font-size: 22px;
      border-bottom: 2px solid var(--accent-color);
      padding-bottom: 6px;
      ${style.h1Center ? 'text-align: center;' : ''}
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
    ul {
      list-style: none;
    }
    li {
      margin-bottom: 0.3em;
    }
    ul li {
      position: relative;
      padding-left: 14px;
    }
    ul li::before {
      content: '${bulletChar}';
      position: absolute;
      left: 0;
      color: var(--accent-color);
      font-weight: bold;
    }
    ol {
      list-style-type: ${style.numberStyle === 'chinese' ? 'cjk-ideographic' : style.numberStyle === 'paren' ? 'none' : 'decimal'};
    }
    ${style.numberStyle === 'paren' ? `
    ol { counter-reset: item; }
    ol li { counter-increment: item; }
    ol li::before { content: '(' counter(item) ') '; color: var(--accent-color); font-weight: 700; }
    ` : ''}
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
      padding: 16px 0;
    }
    ${getTocTitleCss('.toc-title', toc, style)}
    .toc-list {
      display: flex;
      flex-direction: column;
    }
    .toc-item {
      text-decoration: none;
      color: inherit;
      transition: color 0.15s ease;
    }
    .toc-item:hover {
      color: var(--accent-color);
    }
    /* 目录项字体、字号、字形、段前段后与缩进均由分级内联样式驱动，与预览保持完全一致 */

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

    ${getMarkdownBodyCss('.markdown-content', style)}

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
      <span>${header.leftText || ''}</span>
      <span>${header.rightText || meta.title || ''}</span>
    </div>
    ` : ''}

    <div class="cover-page cover-style-${coverStyle}">
      ${coverTemplate.renderHtml({ meta, style, coverListItems })}
    </div>

    ${footer.show && !footer.hideOnCover ? renderFooterHtml(coverPageNum, totalPages, footer, meta) : ''}
  </div>
  ` : ''}

  ${toc.show ? tocPages.map((chunk, chunkIdx) => {
    const tocPageNum = (meta.showCover ? 1 : 0) + chunkIdx + 1;
    return `
  <div class="a4-page toc-page-wrapper">
    ${header.show ? `
    ${header.logoUrl ? `<img src="${header.logoUrl}" style="position: absolute; top: ${header.logoTopOffset ?? 15}px; z-index: 10; height: ${header.logoHeight || 20}px; width: auto; object-fit: contain; opacity: ${header.logoOpacity ?? 1}; pointer-events: none;" alt="Header Logo" />` : ''}
    <div class="doc-header">
      <div class="doc-header-left" style="margin-left: ${header.leftTextOffset ?? 0}px;">
        <span>${header.leftText || ''}</span>
      </div>
      <span>${header.rightText || meta.title || ''}</span>
    </div>
    ` : ''}

    <div class="toc-page">
      ${chunkIdx === 0 || toc.titleOnEveryPage
        ? buildTocTitleHtml(toc, 'toc-title', toc.titleOnEveryPage ? buildTocPageIndicator(chunkIdx, tocPages.length) : '')
        : ''}
      ${chunk.length === 0 ? `
        <p style="color: #94a3b8; font-style: italic; font-size: 13px;">尚未在文档中发现标题项...</p>
      ` : `
        <div class="toc-list">
          ${chunk.map((item) => buildTocItemHtml(item, toc, String(item.pageNumber ?? 1), { href: `#${item.id}`, className: 'toc-item' })).join('')}
        </div>
      `}
    </div>

    ${footer.show ? renderFooterHtml(tocPageNum, totalPages, footer, meta) : ''}
  </div>
  `;
  }).join('') : ''}

  ${(() => {
    const exportCounters = { imgCount: 0, tableCount: 0 };
    const headingCounters = [0, 0, 0, 0];
    const tocAnchorIndex = { value: 0 };
    return rawContentPages.map((pageMd, idx) => {
      const pageNum = (meta.showCover ? 1 : 0) + (toc.show ? tocPages.length : 0) + idx + 1;
      const preprocessed = preprocessMarkdownCaptions(pageMd || '');
      const rawHtml = marked.parse(preprocessed) as string;
      const numberedHtml = addHeadingNumbers(rawHtml, toc.headingNumbering, headingCounters);
      const renderedHtml = postProcessRenderedHtml(numberedHtml, style, exportCounters);
      const pageHtml = toc.show ? addTocAnchors(renderedHtml, toc.maxDepth || 3, tocAnchorIndex) : renderedHtml;

      return `
  <div class="a4-page content-page-wrapper">
    ${header.show ? `
    ${header.logoUrl ? `<img src="${header.logoUrl}" style="position: absolute; top: ${header.logoTopOffset ?? 15}px; z-index: 10; height: ${header.logoHeight || 20}px; width: auto; object-fit: contain; opacity: ${header.logoOpacity ?? 1}; pointer-events: none;" alt="Header Logo" />` : ''}
    <div class="doc-header">
      <div class="doc-header-left" style="margin-left: ${header.leftTextOffset ?? 0}px;">
        <span>${header.leftText || ''}</span>
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

async function measureMermaidHeights(html: string, sources: string[]): Promise<Record<string, number>> {
  if (sources.length === 0 || typeof document === 'undefined') return {};

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '210mm';
  iframe.style.height = '1px';
  iframe.style.visibility = 'hidden';
  iframe.style.pointerEvents = 'none';

  try {
    const loaded = new Promise<void>((resolve) => {
      iframe.addEventListener('load', () => resolve(), { once: true });
    });
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    await loaded;
    await iframe.contentDocument?.fonts?.ready;

    const frameWindow = iframe.contentWindow;
    if (frameWindow) {
      await new Promise<void>((resolve) => frameWindow.requestAnimationFrame(() => resolve()));
    }

    const elements = Array.from(iframe.contentDocument?.querySelectorAll<HTMLElement>('.mermaid') || []);
    return Object.fromEntries(sources.map((source, index) => [source, elements[index]?.offsetHeight || 180]));
  } finally {
    iframe.remove();
  }
}

export async function generatePreparedHtml(markdownText: string, theme: DocumentTheme): Promise<string> {
  const initialHtml = generateStandaloneHtml(markdownText, theme);
  const parsed = new DOMParser().parseFromString(initialHtml, 'text/html');
  const mermaidSources = Array.from(parsed.querySelectorAll<HTMLElement>('.mermaid'))
    .map((element) => element.textContent?.trim() || '');
  const initiallyRenderedHtml = await renderMermaidInHtml(initialHtml);
  const mermaidHeights = await measureMermaidHeights(initiallyRenderedHtml, mermaidSources);
  const renderedHtml = mermaidSources.length > 0
    ? await renderMermaidInHtml(generateStandaloneHtml(markdownText, theme, mermaidHeights))
    : initiallyRenderedHtml;
  return inlineImagesAsDataUris(renderedHtml);
}

export async function exportToHtmlFile(markdownText: string, theme: DocumentTheme, filename?: string): Promise<void> {
  const htmlContent = await generatePreparedHtml(markdownText, theme);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const outName = filename || `${theme.meta.title || '交付文档'}.html`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = outName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
