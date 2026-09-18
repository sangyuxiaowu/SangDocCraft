import { marked } from 'marked';
import { TocItem, DocumentMeta, StyleConfig, ImageStyleConfig, TableCaptionConfig, TocConfig } from '../types';
import { getHeadingText, TOC_ITEMS_PER_PAGE } from './documentStructure';
import { resolveImageSrc } from './tauriHelper';
import { splitExplicitPages } from './pageBreaks';
import { parseImageDimensions } from './imageDimensions';

export { formatPageNumber, getFooterSlots, getHeadingText, getTocChunks, TOC_ITEMS_PER_PAGE } from './documentStructure';

export interface DomPaginationOptions {
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
  primaryColor?: string;
  accentColor?: string;
  textColor?: string;
  h1PageBreak?: boolean;
  headerShow?: boolean;
  footerShow?: boolean;
  style?: StyleConfig;
  mermaidHeights?: Record<string, number>;
}

export function getDocumentFontStack(style: Pick<StyleConfig, 'fontFamily' | 'latinFontFamily'>): string {
  const chineseFontStack = style.fontFamily === 'serif' ? 'SimSun, "Songti SC", STSong, serif' :
    style.fontFamily === 'kaiti' ? 'KaiTi, "Kaiti SC", STKaiti, serif' :
    style.fontFamily === 'heiti' ? 'SimHei, "Heiti SC", STHeiti, sans-serif' :
    style.fontFamily === 'mono' ? 'Consolas, "Fira Code", Monaco, monospace' :
    '"PingFang SC", "Microsoft YaHei", sans-serif';

  return `${style.latinFontFamily || 'Times New Roman'}, ${chineseFontStack}`;
}

export function getTocTitleCss(selector: string, toc: TocConfig, style: StyleConfig): string {
  const titleStyle = toc.titleStyle ?? 'underline';
  return `${selector} {
    color: ${style.primaryColor};
    text-align: ${toc.titleCenter ? 'center' : 'left'};
    border-bottom: ${titleStyle === 'underline' ? `2px solid ${style.accentColor}` : 'none'};
    border-left: ${titleStyle === 'accent-block' ? `5px solid ${style.accentColor}` : 'none'};
    background: ${titleStyle === 'badge' ? `${style.accentColor}18` : 'transparent'};
    padding: ${titleStyle === 'badge' ? '6px 12px' : titleStyle === 'accent-block' ? '0 0 0 10px' : titleStyle === 'underline' ? '0 0 8px' : '0'};
  }`;
}

export function getMarkdownBodyCss(selector: string, style: StyleConfig): string {
  const bulletChar = style.bulletStyle === 'square' ? '■' :
    style.bulletStyle === 'checkmark' ? '✓' :
    style.bulletStyle === 'arrow' ? '▸' : '•';
  const minimalTable = style.tableStyle === 'minimal';
  const borderedTable = style.tableStyle === 'bordered';
  const tableHeaderBackground = minimalTable ? 'transparent' : 'var(--primary-color)';
  const tableHeaderColor = minimalTable ? style.primaryColor : '#fff';
  const tableBorder = minimalTable ? `border-top: 1px solid ${style.primaryColor}; border-bottom: 1px solid ${style.primaryColor};` : '';
  const tableHeaderBorder = minimalTable ? `border: none; border-bottom: 1px solid ${style.primaryColor};` : borderedTable ? 'border: 1px solid var(--primary-color);' : '';
  const tableCellBorder = minimalTable ? 'border: none;' : 'border: 1px solid #e2e8f0;';
  const tableTextAlign = minimalTable ? 'center' : 'left';
  const tableHeaderWeight = minimalTable ? 400 : 600;

  return `
    ${selector} { font-family: ${style.bodyFontFamily || 'inherit'}; }
    ${selector} > :first-child { margin-top: 0 !important; }
    ${selector} > :last-child { margin-bottom: 0 !important; }
    ${selector} h1 {
      font-family: ${style.headingFonts.h1.fontFamily};
      font-size: ${style.headingFonts.h1.fontSize}px;
      font-weight: ${style.headingFonts.h1.bold ? 700 : 400};
      font-style: ${style.headingFonts.h1.italic ? 'italic' : 'normal'};
      text-decoration: ${style.headingFonts.h1.underline ? 'underline' : 'none'};
      color: var(--primary-color);
      margin-top: ${style.headingFonts.h1.marginBefore}px;
      margin-bottom: ${style.headingFonts.h1.marginAfter}px;
      padding: ${style.h1Style === 'badge' ? '0.25em 0.5em' : style.h1Style === 'accent-block' ? '0 0 0 0.45em' : '0 0 0.3em'};
      background: ${style.h1Style === 'badge' ? `${style.accentColor}18` : 'transparent'};
      border-bottom: ${style.h1Style === 'underline' ? '2px solid var(--accent-color)' : 'none'};
      border-left: ${style.h1Style === 'accent-block' ? '5px solid var(--accent-color)' : 'none'};
      ${style.h1Center ? 'text-align: center;' : ''}
    }
    ${selector} h2 {
      font-family: ${style.headingFonts.h2.fontFamily};
      font-size: ${style.headingFonts.h2.fontSize}px;
      font-weight: ${style.headingFonts.h2.bold ? 700 : 400};
      font-style: ${style.headingFonts.h2.italic ? 'italic' : 'normal'};
      text-decoration: ${style.headingFonts.h2.underline ? 'underline' : 'none'};
      color: var(--primary-color);
      margin-top: ${style.headingFonts.h2.marginBefore}px;
      margin-bottom: ${style.headingFonts.h2.marginAfter}px;
      padding-left: ${style.h2Style === 'border-left' ? '8px' : '0'};
      border-left: ${style.h2Style === 'border-left' ? '4px solid var(--accent-color)' : 'none'};
      padding-bottom: ${style.h2Style === 'underline-subtle' ? '0.25em' : '0'};
      border-bottom: ${style.h2Style === 'underline-subtle' ? '1px solid var(--accent-color)' : 'none'};
    }
    ${selector} h3 {
      font-family: ${style.headingFonts.h3.fontFamily};
      font-size: ${style.headingFonts.h3.fontSize}px;
      font-weight: ${style.headingFonts.h3.bold ? 700 : 400};
      font-style: ${style.headingFonts.h3.italic ? 'italic' : 'normal'};
      text-decoration: ${style.headingFonts.h3.underline ? 'underline' : 'none'};
      color: var(--primary-color);
      margin-top: ${style.headingFonts.h3.marginBefore}px;
      margin-bottom: ${style.headingFonts.h3.marginAfter}px;
    }
    ${selector} h4 {
      font-family: ${style.headingFonts.h4.fontFamily};
      font-size: ${style.headingFonts.h4.fontSize}px;
      font-weight: ${style.headingFonts.h4.bold ? 700 : 400};
      font-style: ${style.headingFonts.h4.italic ? 'italic' : 'normal'};
      text-decoration: ${style.headingFonts.h4.underline ? 'underline' : 'none'};
      color: var(--primary-color);
      margin-top: ${style.headingFonts.h4.marginBefore}px;
      margin-bottom: ${style.headingFonts.h4.marginAfter}px;
    }
    ${selector} p { margin-bottom: 0.9em; line-height: inherit; text-indent: ${style.indentParagraph ? '2em' : '0'}; }
    ${selector} p.p-continuation, ${selector} .p-continuation p, ${selector} blockquote p, ${selector} li p, ${selector} table p { text-indent: 0 !important; }
    ${selector} blockquote { border-left: 4px solid var(--accent-color); background: #f8fafc; padding: 10px 16px; margin: 1.2em 0; border-radius: 0 6px 6px 0; color: #475569; font-style: italic; }
    ${selector} pre { background: ${style.codeTheme === 'light' ? '#f1f5f9' : '#0f172a'}; color: ${style.codeTheme === 'light' ? '#0f172a' : '#f8fafc'}; padding: 12px 16px; border-radius: 6px; overflow-x: auto; font-family: Consolas, monospace; font-size: 0.85em; margin: 1em 0; white-space: pre-wrap; word-break: break-all; overflow-wrap: break-word; }
    ${selector} code { background: #f1f5f9; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-family: Consolas, monospace; font-size: 0.88em; }
    ${selector} pre code { background: transparent; color: inherit; padding: 0; }
    ${selector} .mermaid { display: flex; align-items: center; justify-content: center; min-height: 180px; max-height: 720px; margin: 1.2em 0; overflow: hidden; text-indent: 0; }
    ${selector} .mermaid-error { display: block; min-height: 0; }
    ${selector} .mermaid svg { width: auto; height: auto; max-width: 100%; max-height: 720px; }
    ${selector} ul { margin: 0.8em 0; padding-left: 20px; list-style: none; }
    ${selector} ul li { position: relative; padding-left: 14px; margin-bottom: 0.3em; }
    ${selector} ul li::before { content: "${bulletChar}"; position: absolute; left: 0; color: var(--accent-color); font-weight: bold; }
    ${selector} ol { margin: 0.8em 0; padding-left: 20px; list-style-type: ${style.numberStyle === 'chinese' ? 'cjk-ideographic' : style.numberStyle === 'paren' ? 'none' : 'decimal'}; }
    ${selector} ol li { margin-bottom: 0.3em; }
    ${style.numberStyle === 'paren' ? `${selector} ol { counter-reset: item; } ${selector} ol li { counter-increment: item; } ${selector} ol li::before { content: '(' counter(item) ') '; color: var(--accent-color); font-weight: 700; }` : ''}
    ${selector} table { width: 100%; border-collapse: collapse; ${tableBorder} margin: 1.2em 0; font-size: 0.9em; table-layout: auto; word-break: break-word; overflow-wrap: break-word; }
    ${selector} th { background: ${tableHeaderBackground}; color: ${tableHeaderColor}; ${tableHeaderBorder} padding: 8px 12px; text-align: ${tableTextAlign}; font-weight: ${tableHeaderWeight}; }
    ${selector} td { ${tableCellBorder} padding: 8px 12px; text-align: ${tableTextAlign}; }
    ${selector} tr:nth-child(even) { background: ${style.tableStyle === 'striped' ? '#f8fafc' : 'transparent'}; }
    ${selector} hr { border: none; border-top: 1px solid #cbd5e1; margin: 1.8em 0; }
  `;
}

/**
 * Calculates effective character length considering CJK (1.0) vs ASCII/Latin (0.52)
 */
export function getEffectiveCharLength(str: string): number {
  if (!str) return 0;
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // CJK, Fullwidth, Hangul, Hiragana/Katakana
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xffef) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0x3040 && code <= 0x30ff)
    ) {
      len += 1.0;
    } else {
      len += 0.52;
    }
  }
  return len;
}

function buildListMd(items: any[], ordered: boolean, startIdx: number): string {
  return items.map((item: any, idx: number) => {
    const prefix = ordered ? `${startIdx + idx}. ` : '- ';
    const text = `${item.task ? `[${item.checked ? 'x' : ' '}] ` : ''}${String(item.text || '').trimEnd()}`;
    const indentedText = text.replace(/\n/g, `\n${' '.repeat(prefix.length)}`);
    return `${prefix}${indentedText}`;
  }).join('\n');
}

function buildTableMd(token: any, start: number, end: number = token.rows.length): string {
  const lines = token.raw.trimEnd().split('\n');
  return [...lines.slice(0, 2), ...lines.slice(2 + start, 2 + end)].join('\n');
}

function buildCodeMd(lines: string[], lang: string = ''): string {
  return `\`\`\`${lang}\n${lines.join('\n')}\n\`\`\``;
}

function paragraphContainsImage(token: any): boolean {
  return Array.isArray(token.tokens) && token.tokens.some((inlineToken: any) => inlineToken.type === 'image');
}

function findDomParagraphSplit(
  text: string,
  measurer: HTMLElement,
  maxHeight: number
): { part1: string; part2: string } | null {
  if (!text || text.length < 10) return null;

  const testP = document.createElement('p');
  testP.className = 'p-continuation';
  measurer.appendChild(testP);

  let low = 1;
  let high = text.length;
  let bestFitIdx = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    testP.innerHTML = marked.parseInline(text.slice(0, mid)) as string;
    
    if (measurer.scrollHeight <= maxHeight + 1) {
      bestFitIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  measurer.removeChild(testP);

  if (bestFitIdx <= 5 || bestFitIdx >= text.length - 2) {
    return null;
  }

  let splitIdx = -1;
  for (let i = bestFitIdx; i >= Math.max(5, bestFitIdx - 35); i--) {
    if (['。', '！', '？', '\n'].includes(text[i])) {
      splitIdx = i + 1;
      break;
    }
  }
  if (splitIdx === -1) {
    for (let i = bestFitIdx; i >= Math.max(5, bestFitIdx - 25); i--) {
      if (['，', '；', '、', ',', ';', '.', ' '].includes(text[i])) {
        splitIdx = i + 1;
        break;
      }
    }
  }
  if (splitIdx === -1) {
    splitIdx = bestFitIdx;
  }

  const part1 = text.slice(0, splitIdx).trim();
  const part2 = text.slice(splitIdx).trim();

  if (!part1 || !part2) return null;

  return { part1, part2 };
}

function findDomListSplit(
  token: any,
  measurer: HTMLElement,
  maxHeight: number
): { part1Md: string; part2Md: string } | null {
  const items = token.items || [];
  if (items.length <= 1) return null;

  let testNodes: ChildNode[] = [];
  let fitCount = 0;
  for (let i = 0; i < items.length; i++) {
    testNodes.forEach(node => node.remove());
    const testMarkdown = buildListMd(items.slice(0, i + 1), token.ordered, Number(token.start) || 1);
    const template = document.createElement('template');
    template.innerHTML = marked.parse(testMarkdown) as string;
    testNodes = Array.from(template.content.childNodes);
    measurer.append(...testNodes);

    if (measurer.scrollHeight <= maxHeight + 1) {
      fitCount = i + 1;
    } else {
      break;
    }
  }

  testNodes.forEach(node => node.remove());

  if (fitCount < 1 || fitCount >= items.length) return null;

  const part1Items = items.slice(0, fitCount);
  const part2Items = items.slice(fitCount);

  return {
    part1Md: buildListMd(part1Items, token.ordered, Number(token.start) || 1),
    part2Md: buildListMd(part2Items, token.ordered, (Number(token.start) || 1) + fitCount),
  };
}

function findDomCodeSplit(
  token: any,
  measurer: HTMLElement,
  maxHeight: number
): { part1Md: string; part2Md: string } | null {
  const codeText = token.text || token.raw || '';
  const lines = codeText.split('\n');
  if (lines.length <= 2) return null;

  const testPre = document.createElement('pre');
  const testCode = document.createElement('code');
  testPre.appendChild(testCode);
  measurer.appendChild(testPre);

  let fitCount = 0;
  for (let i = 0; i < lines.length; i++) {
    testCode.textContent = lines.slice(0, i + 1).join('\n');
    if (measurer.scrollHeight <= maxHeight + 1) {
      fitCount = i + 1;
    } else {
      break;
    }
  }

  measurer.removeChild(testPre);

  if (fitCount < 1 || fitCount >= lines.length) return null;

  return {
    part1Md: buildCodeMd(lines.slice(0, fitCount), token.lang),
    part2Md: buildCodeMd(lines.slice(fitCount), token.lang),
  };
}

function findDomTableSplit(
  token: any,
  measurer: HTMLElement,
  maxHeight: number
): { part1Md: string; part2Md: string } | null {
  const header = token.header || [];
  const rows = token.rows || [];
  if (rows.length <= 1) return null;

  const testTable = document.createElement('table');
  measurer.appendChild(testTable);

  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  header.forEach((h: any) => {
    const th = document.createElement('th');
    th.innerHTML = marked.parseInline(h.text || h.raw || '') as string;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  testTable.appendChild(thead);

  const tbody = document.createElement('tbody');
  testTable.appendChild(tbody);

  let fitCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const tr = document.createElement('tr');
    rows[i].forEach((cell: any) => {
      const td = document.createElement('td');
      td.innerHTML = marked.parseInline(cell.text || cell.raw || '') as string;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);

    if (measurer.scrollHeight <= maxHeight + 1) {
      fitCount = i + 1;
    } else {
      break;
    }
  }

  measurer.removeChild(testTable);

  if (fitCount < 1 || fitCount >= rows.length) return null;

  return {
    part1Md: buildTableMd(token, 0, fitCount),
    part2Md: buildTableMd(token, fitCount),
  };
}

/**
 * Dynamically measures content overflow in DOM layout engine and splits markdown with pixel precision
 */
export function paginateContentByDom(
  markdownText: string,
  options: DomPaginationOptions = {}
): string[] {
  const paginationMode = options.style?.paginationMode || 'auto';
  if (paginationMode === 'manual') return splitExplicitPages(markdownText);
  if (typeof document === 'undefined') {
    return splitContentByPages(markdownText, options.h1PageBreak);
  }

  const initialChunks = splitExplicitPages(markdownText);
  const pages: string[] = [];

  const measurer = document.createElement('div');
  measurer.className = 'pagination-measurer';
  measurer.style.position = 'absolute';
  measurer.style.left = '-9999px';
  measurer.style.top = '-9999px';
  measurer.style.visibility = 'hidden';
  measurer.style.pointerEvents = 'none';
  measurer.style.boxSizing = 'border-box';
  measurer.style.display = 'flow-root';
  measurer.style.width = '180mm';
  measurer.style.fontFamily = options.fontFamily || 'sans-serif';
  measurer.style.fontSize = `${options.fontSize || 14}px`;
  measurer.style.lineHeight = `${options.lineHeight || 1.6}`;
  measurer.style.color = options.textColor || '#0f172a';
  measurer.style.setProperty('--primary-color', options.primaryColor || '#1e293b');
  measurer.style.setProperty('--accent-color', options.accentColor || '#2563eb');

  const measurerStyles = document.createElement('style');
  if (options.style) {
    measurerStyles.textContent = getMarkdownBodyCss('.pagination-measurer', options.style);
  }
  document.head.appendChild(measurerStyles);
  document.body.appendChild(measurer);

  // Height available inside A4 sheet body area:
  // A4 total height at 96dpi = 1122.5px
  // Top padding (20mm = ~75.6px) + Bottom padding (20mm = ~75.6px) = 151.2px
  const headerHeight = options.headerShow ? 38 : 0;
  const footerHeight = options.footerShow ? 38 : 0;
  const maxHeight = 1122.5 - 151.2 - headerHeight - footerHeight - 6;

  try {
    initialChunks.forEach((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return;

      const preprocessedChunk = preprocessMarkdownCaptions(trimmed);

      let tokens: any[] = [];
      try {
        tokens = marked.lexer(preprocessedChunk);
      } catch (e) {
        tokens = [];
      }

      if (!tokens || tokens.length === 0) {
        pages.push(trimmed);
        return;
      }

      let currentPageTokens: string[] = [];
      measurer.innerHTML = '';

      const flushPage = () => {
        if (currentPageTokens.length > 0) {
          const pageMd = currentPageTokens.join('\n\n').trim();
          if (pageMd) {
            pages.push(pageMd);
          }
          currentPageTokens = [];
          measurer.innerHTML = '';
        }
      };

      const processToken = (token: any) => {
        if (token.type === 'space') return;
        const isH1 = token.type === 'heading' && token.depth === 1;
        const isHeading = token.type === 'heading';

        if (options.h1PageBreak && isH1 && currentPageTokens.length > 0) {
          flushPage();
        }

        if (isHeading && currentPageTokens.length > 0) {
          const remSpace = maxHeight - measurer.scrollHeight;
          if (remSpace < 48) {
            flushPage();
          }
        }

        const tempContainer = document.createElement('template');
        const rawTokenHtml = marked.parse(token.raw || '') as string;
        tempContainer.innerHTML = postProcessRenderedHtml(rawTokenHtml, options.style);
        if (token.type === 'code' && token.lang?.toLowerCase() === 'mermaid') {
          const mermaidElement = tempContainer.content.querySelector<HTMLElement>('.mermaid');
          const source = mermaidElement?.textContent?.trim();
          const measuredHeight = source ? options.mermaidHeights?.[source] : undefined;
          if (mermaidElement && measuredHeight !== undefined) {
            mermaidElement.style.height = `${Math.min(720, Math.max(180, measuredHeight))}px`;
          }
        }
        const tokenNodes = Array.from(tempContainer.content.childNodes);
        measurer.append(...tokenNodes);

        if (measurer.scrollHeight <= maxHeight) {
          currentPageTokens.push(token.raw);
          return;
        }

        tokenNodes.forEach(node => node.remove());

        if (token.type === 'paragraph' && !paragraphContainsImage(token)) {
          const splitRes = findDomParagraphSplit(token.text || token.raw || '', measurer, maxHeight);
          if (splitRes) {
            currentPageTokens.push(splitRes.part1);
            flushPage();
            processToken({ ...token, type: 'paragraph', text: splitRes.part2, raw: splitRes.part2 });
            return;
          }
        } else if (token.type === 'list') {
          const splitRes = findDomListSplit(token, measurer, maxHeight);
          if (splitRes) {
            currentPageTokens.push(splitRes.part1Md);
            flushPage();
            const newToken = marked.lexer(splitRes.part2Md)[0] || { type: 'raw', raw: splitRes.part2Md };
            processToken(newToken);
            return;
          }
        } else if (token.type === 'table') {
          const splitRes = findDomTableSplit(token, measurer, maxHeight);
          if (splitRes) {
            currentPageTokens.push(splitRes.part1Md);
            flushPage();
            const newToken = marked.lexer(splitRes.part2Md)[0] || { type: 'raw', raw: splitRes.part2Md };
            processToken(newToken);
            return;
          }
        } else if (token.type === 'code' && token.lang?.toLowerCase() !== 'mermaid') {
          const splitRes = findDomCodeSplit(token, measurer, maxHeight);
          if (splitRes) {
            currentPageTokens.push(splitRes.part1Md);
            flushPage();
            const newToken = marked.lexer(splitRes.part2Md)[0] || { type: 'raw', raw: splitRes.part2Md };
            processToken(newToken);
            return;
          }
        }

        if (currentPageTokens.length === 0) {
          currentPageTokens.push(token.raw);
          measurer.append(...tokenNodes);
          return;
        }

        flushPage();
        processToken(token);
      };

      tokens.forEach((token) => processToken(token));
      flushPage();
    });
  } finally {
    if (document.body.contains(measurer)) {
      document.body.removeChild(measurer);
    }
    measurerStyles.remove();
  }

  return pages.length > 0 ? pages : [markdownText];
}

/**
 * Extracts H1, H2, H3 headings from markdown to build Table of Contents items with calculated page numbers
 */
export function parseTableOfContents(
  markdown: string, 
  maxDepth: number = 3, 
  meta?: Partial<DocumentMeta>, 
  tocShow: boolean = true,
  h1PageBreak: boolean = false,
  paginatedContent?: string[],
  headingNumbering: TocConfig['headingNumbering'] = 'none'
): TocItem[] {
  const showCover = meta?.showCover !== false;
  const showToc = tocShow !== false;

  const contentPages = paginatedContent || splitContentByPages(markdown, h1PageBreak);

  // Compute total TOC pages if TOC is shown
  let tocPagesCount = 0;
  if (showToc) {
    let totalHeadingsCount = 0;
    contentPages.forEach((pageMd) => {
      let tokens: any[] = [];
      try { tokens = marked.lexer(pageMd); } catch (e) { tokens = []; }
      tokens.forEach((token) => {
        if (token.type === 'heading' && token.depth <= maxDepth) {
          totalHeadingsCount++;
        }
      });
    });
    tocPagesCount = Math.max(1, Math.ceil(totalHeadingsCount / TOC_ITEMS_PER_PAGE));
  }

  const firstContentPageNum = (showCover ? 1 : 0) + (showToc ? tocPagesCount : 0) + 1;

  const items: TocItem[] = [];
  let index = 1;
  const counters = [0, 0, 0, 0];

  contentPages.forEach((pageMd, pageIdx) => {
    const pageNum = firstContentPageNum + pageIdx;
    let tokens: any[] = [];
    try {
      tokens = marked.lexer(pageMd);
    } catch (e) {
      tokens = [];
    }

    tokens.forEach((token) => {
      if (token.type === 'heading' && token.depth <= maxDepth) {
        items.push({
          id: `heading-${index++}`,
          text: getHeadingText(token.text, token.depth, counters, headingNumbering),
          level: token.depth,
          pageNumber: pageNum,
        });
      }
    });
  });

  return items;
}

/**
 * Splits markdown content by explicit pagebreak tags, level 1 headings (if enabled), and automatically when content overflows A4 printable height
 */
export function splitContentByPages(markdown: string, h1PageBreak: boolean = false, paginationMode: 'auto' | 'manual' = 'auto'): string[] {
  const contentToSplit = markdown.trim();
  if (!contentToSplit) return [''];

  const initialChunks = splitExplicitPages(contentToSplit);
  if (paginationMode === 'manual') return initialChunks;

  const pages: string[] = [];
  // Target printable capacity for A4 body area (~37.5 standard text line height units, perfectly matching A4 ~910px usable content height)
  const MAX_PAGE_UNITS = 37.5;

  const estimateTokenUnits = (token: any): number => {
    if (!token) return 1;
    if (token.type === 'heading') {
      return token.depth === 1 ? 2.2 : token.depth === 2 ? 1.6 : token.depth === 3 ? 1.3 : 1.1;
    }
    if (token.type === 'paragraph') {
      const text = token.text || token.raw || '';
      const effLen = getEffectiveCharLength(text);
      const textLines = Math.max(1, Math.ceil(effLen / 41));
      return textLines * 1.0 + 0.2;
    }
    if (token.type === 'code') {
      const text = token.text || token.raw || '';
      const lines = text.split('\n').length;
      return lines * 0.77 + 0.8;
    }
    if (token.type === 'table') {
      const rowCount = (token.rows || []).length + 1;
      return rowCount * 1.05 + 0.5;
    }
    if (token.type === 'list') {
      const items = token.items || [];
      let totalLines = 0;
      items.forEach((item: any) => {
        const itemText = item.text || item.raw || '';
        totalLines += Math.max(1, Math.ceil(getEffectiveCharLength(itemText) / 38));
      });
      return totalLines * 0.9 + 0.3;
    }
    if (token.type === 'blockquote') {
      const text = token.text || token.raw || '';
      const textLines = Math.max(1, Math.ceil(getEffectiveCharLength(text) / 38));
      return textLines * 1.0 + 0.4;
    }
    if (token.type === 'space' || token.type === 'hr') {
      return 0.4;
    }
    if (token.type === 'image') {
      return 12.0;
    }
    return 1.0;
  };

  // Helper to split a long paragraph text across page boundaries
  const splitParagraph = (text: string, availUnits: number) => {
    const targetEffChars = Math.floor((availUnits - 0.2) * 41);
    if (targetEffChars < 10 || text.length < 10) {
      return null;
    }

    let currentEff = 0;
    let targetIdx = text.length - 1;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const charEff = ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)) ? 1.0 : 0.52;
      currentEff += charEff;
      if (currentEff >= targetEffChars) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx <= 5 || targetIdx >= text.length - 5) {
      return null;
    }

    let splitIdx = -1;
    // 1. Search backwards from targetIdx for sentence end (。, ！, ？, \n)
    for (let i = targetIdx; i >= Math.max(5, targetIdx - 35); i--) {
      if (['。', '！', '？', '\n'].includes(text[i])) {
        splitIdx = i + 1;
        break;
      }
    }

    // 2. Search backwards for clause end (，, ；, 、, ;, ,, ., ' ')
    if (splitIdx === -1) {
      for (let i = targetIdx; i >= Math.max(5, targetIdx - 25); i--) {
        if (['，', '；', '、', ',', ';', '.', ' '].includes(text[i])) {
          splitIdx = i + 1;
          break;
        }
      }
    }

    // 3. Fallback: split right at targetIdx if no punctuation found
    if (splitIdx === -1) {
      splitIdx = targetIdx;
    }

    const firstText = text.slice(0, splitIdx).trim();
    const secondText = text.slice(splitIdx).trim();

    if (!firstText || !secondText) return null;

    return {
      firstRaw: firstText,
      secondRaw: secondText,
    };
  };

  // Helper to split a long table token
  const splitTable = (token: any, availUnits: number) => {
    const rows = token.rows || [];
    if (rows.length <= 1) return null;

    const fitRowsCount = Math.floor((availUnits - 0.5) / 1.05) - 1;
    if (fitRowsCount < 1 || fitRowsCount >= rows.length) return null;

    const firstTableRaw = buildTableMd(token, 0, fitRowsCount);
    const secondTableRaw = buildTableMd(token, fitRowsCount);

    return {
      firstRaw: firstTableRaw,
      secondRaw: secondTableRaw,
    };
  };

  // Helper to split a code block token
  const splitCode = (token: any, availUnits: number) => {
    const codeText = token.text || token.raw || '';
    const lines = codeText.split('\n');
    if (lines.length <= 2) return null;

    const fitLinesCount = Math.floor((availUnits - 0.8) / 0.77);
    if (fitLinesCount < 1 || fitLinesCount >= lines.length) return null;

    const firstLines = lines.slice(0, fitLinesCount);
    const secondLines = lines.slice(fitLinesCount);

    const lang = token.lang || '';
    const firstRaw = `\`\`\`${lang}\n${firstLines.join('\n')}\n\`\`\``;
    const secondRaw = `\`\`\`${lang}\n${secondLines.join('\n')}\n\`\`\``;

    return {
      firstRaw,
      secondRaw,
    };
  };

  // Helper to split a list token
  const splitList = (token: any, availUnits: number) => {
    const items = token.items || [];
    if (items.length <= 1) return null;

    let fitCount = 0;
    let unitsUsed = 0.3;

    for (let i = 0; i < items.length; i++) {
      const itemText = items[i].text || items[i].raw || '';
      const itemUnits = Math.max(1, Math.ceil(getEffectiveCharLength(itemText) / 38)) * 0.9;
      if (unitsUsed + itemUnits <= availUnits) {
        unitsUsed += itemUnits;
        fitCount++;
      } else {
        break;
      }
    }

    if (fitCount < 1 || fitCount >= items.length) return null;

    const part1Items = items.slice(0, fitCount);
    const part2Items = items.slice(fitCount);

    return {
      firstRaw: buildListMd(part1Items, token.ordered, Number(token.start) || 1),
      secondRaw: buildListMd(part2Items, token.ordered, (Number(token.start) || 1) + fitCount),
    };
  };

  initialChunks.forEach((chunk) => {
    const trimmed = chunk.trim();
    if (!trimmed) return;

    let tokens: any[] = [];
    try {
      tokens = marked.lexer(trimmed);
    } catch (e) {
      tokens = [];
    }

    if (!tokens || tokens.length === 0) {
      pages.push(trimmed);
      return;
    }

    let currentPageTokens: string[] = [];
    let currentUnits = 0;

    const flushPage = () => {
      if (currentPageTokens.length > 0) {
        const pageMd = currentPageTokens.join('\n\n').trim();
        if (pageMd) {
          pages.push(pageMd);
        }
        currentPageTokens = [];
        currentUnits = 0;
      }
    };

    const processToken = (token: any) => {
      const isH1 = token.type === 'heading' && token.depth === 1;
      const isHeading = token.type === 'heading';
      const tokenUnits = estimateTokenUnits(token);

      // Level 1 heading forced page break option
      if (h1PageBreak && isH1 && currentPageTokens.length > 0) {
        flushPage();
      }

      // Heading orphan prevention: Only flush if remaining space is less than heading + 1 line (1.0 unit)
      const remainingBeforeHeading = MAX_PAGE_UNITS - currentUnits;
      if (isHeading && currentPageTokens.length > 0 && remainingBeforeHeading < tokenUnits + 1.0) {
        flushPage();
      }

      // Check if current token fits on current page
      if (currentUnits + tokenUnits <= MAX_PAGE_UNITS) {
        currentPageTokens.push(token.raw);
        currentUnits += tokenUnits;
        return;
      }

      // Overflow handling: try smart splitting
      const availUnits = MAX_PAGE_UNITS - currentUnits;

      if (token.type === 'paragraph' && !paragraphContainsImage(token)) {
        const splitRes = splitParagraph(token.text || token.raw || '', availUnits);
        if (splitRes) {
          currentPageTokens.push(splitRes.firstRaw);
          flushPage();
          marked.lexer(splitRes.secondRaw).forEach(processToken);
          return;
        }
      } else if (token.type === 'table') {
        const splitRes = splitTable(token, availUnits);
        if (splitRes) {
          currentPageTokens.push(splitRes.firstRaw);
          flushPage();
          marked.lexer(splitRes.secondRaw).forEach(processToken);
          return;
        }
      } else if (token.type === 'code') {
        const splitRes = splitCode(token, availUnits);
        if (splitRes) {
          currentPageTokens.push(splitRes.firstRaw);
          flushPage();
          marked.lexer(splitRes.secondRaw).forEach(processToken);
          return;
        }
      } else if (token.type === 'list') {
        const splitRes = splitList(token, availUnits);
        if (splitRes) {
          currentPageTokens.push(splitRes.firstRaw);
          flushPage();
          marked.lexer(splitRes.secondRaw).forEach(processToken);
          return;
        }
      }

      // Default overflow behavior if block cannot be split or availUnits is too small:
      // Flush current page and start a new page with the full block
      if (currentPageTokens.length > 0) {
        flushPage();
        processToken(token);
        return;
      }
      currentPageTokens.push(token.raw);
      currentUnits = tokenUnits;
    };

    tokens.forEach(processToken);

    flushPage();
  });

  return pages.length > 0 ? pages : [contentToSplit];
}

/**
 * Preprocesses markdown text to detect table captions and inject markers before table HTML
 */
export function preprocessMarkdownCaptions(markdownText: string): string {
  return markdownText || '';
}

function escapeHtmlAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Post-processes rendered HTML to wrap images in figure tags with border styles and captions,
 * and format table captions according to StyleConfig settings.
 */
export function postProcessRenderedHtml(
  html: string,
  style?: StyleConfig,
  counters: { imgCount: number; tableCount: number } = { imgCount: 0, tableCount: 0 }
): string {
  if (!html) return '';

  const mermaidProcessed = html.replace(
    /<pre><code class=["']language-mermaid["']>([\s\S]*?)<\/code><\/pre>/gi,
    '<div class="mermaid">$1</div>'
  );

  const imgConfig: ImageStyleConfig = {
    borderStyle: style?.imageConfig?.borderStyle || 'subtle',
    borderColor: style?.imageConfig?.borderColor || '#cbd5e1',
    showCaption: style?.imageConfig?.showCaption !== false,
    autoNumber: style?.imageConfig?.autoNumber !== false,
    numberPrefix: style?.imageConfig?.numberPrefix || '图 ',
    captionAlign: style?.imageConfig?.captionAlign || 'center',
  };

  const tblConfig: TableCaptionConfig = {
    showCaption: style?.tableCaptionConfig?.showCaption !== false,
    autoNumber: style?.tableCaptionConfig?.autoNumber !== false,
    numberPrefix: style?.tableCaptionConfig?.numberPrefix || '表 ',
    captionPosition: style?.tableCaptionConfig?.captionPosition || 'top',
    captionAlign: style?.tableCaptionConfig?.captionAlign || 'center',
  };

  // 1. Process <img> tags into <figure> with border styling and captions
  let processed = mermaidProcessed.replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)\/?>\s*(?:\{([^{}]*)\})?/gi, (match, p1, rawSrc, p2, dimensionAttributes) => {
    const combinedAttrs = `${p1} ${p2}`;

    const altMatch = combinedAttrs.match(/alt=["']([^"']*)["']/i);
    const rawAlt = altMatch ? altMatch[1] : '';

    const titleMatch = combinedAttrs.match(/title=["']([^"']*)["']/i);
    const title = titleMatch ? titleMatch[1] : '';

    const resolvedSrc = resolveImageSrc(rawSrc);

    const captionRaw = (rawAlt && rawAlt !== 'alt' && !rawAlt.startsWith('http')) ? rawAlt : title;

    let captionHtml = '';
    if (imgConfig.showCaption && captionRaw) {
      let cleanCaption = captionRaw.replace(/^(?:图|表|Figure|Table)\s*\d*[:：]?\s*/i, '').trim();

      if (imgConfig.autoNumber) {
        counters.imgCount++;
        cleanCaption = `${imgConfig.numberPrefix}${counters.imgCount}: ${cleanCaption}`;
      }

      captionHtml = `<figcaption class="doc-image-caption" style="text-align: ${imgConfig.captionAlign};">${cleanCaption}</figcaption>`;
    }

    const borderClass = `doc-img-border-${imgConfig.borderStyle}`;
    const dimensions = parseImageDimensions(dimensionAttributes);
    const dimensionStyle = dimensions
      ? `${dimensions.width ? `width: ${dimensions.width}px; ` : 'width: auto; '}${dimensions.height ? `height: ${dimensions.height}px; ` : 'height: auto; '}`
      : 'height: auto; ';
    const unparsedSuffix = dimensionAttributes && !dimensions ? `{${dimensionAttributes}}` : '';

    return `<figure class="doc-image-figure" style="text-align: ${imgConfig.captionAlign}; margin: 1.2em auto;">
      <img src="${resolvedSrc}" alt="${rawAlt || 'Image'}" class="doc-image ${borderClass}" style="max-width: 100%; ${dimensionStyle}display: inline-block;" />
      ${captionHtml}
    </figure>${unparsedSuffix}`;
  });

  // 2. Process Tables and Table Captions
  const handleTableCaption = (captionRaw: string, tableHtml: string) => {
    if (!tblConfig.showCaption || !captionRaw) {
      return tableHtml;
    }

    let cleanCaption = captionRaw.replace(/^(?:图|表|Figure|Table)\s*\d*[:：]?\s*/i, '').trim();
    if (tblConfig.autoNumber) {
      counters.tableCount++;
      cleanCaption = `${tblConfig.numberPrefix}${counters.tableCount}: ${cleanCaption}`;
    }

    const captionElement = `<div class="doc-table-caption" style="text-align: ${tblConfig.captionAlign};">${cleanCaption}</div>`;

    if (tblConfig.captionPosition === 'top') {
      return `<div class="doc-table-wrapper" style="margin: 1.2em 0;">${captionElement}${tableHtml}</div>`;
    } else {
      return `<div class="doc-table-wrapper" style="margin: 1.2em 0;">${tableHtml}${captionElement}</div>`;
    }
  };

  // 2a. Match comment captions: <!-- caption: XXX --> or <!-- table-caption: XXX --> (with optional <p> or newlines) before <table>
  processed = processed.replace(
    /(?:<p>\s*)?<!--\s*(?:table-)?caption:\s*([\s\S]*?)\s*-->(?:\s*<\/p>)?\s*(<table[\s\S]*?<\/table>)/gi,
    (_, captionRaw, tableHtml) => handleTableCaption(captionRaw, tableHtml)
  );

  // 2b. Match text captions: <p>表 1: XXX</p> or <p>[表 1: XXX]</p> or <p>Table 1: XXX</p> before <table>
  processed = processed.replace(
    /<p>\s*(?:\[)?(?:Table|表)\s*\d*[:：]?\s*(.*?)(?:\])?\s*<\/p>\s*(<table[\s\S]*?<\/table>)/gi,
    (_, captionRaw, tableHtml) => handleTableCaption(captionRaw, tableHtml)
  );

  // 2c. Match hook tags if present
  processed = processed.replace(
    /<div\s+class=["']doc-table-caption-hook["']\s+data-caption=["']([^"']*)["']><\/div>\s*(<table[\s\S]*?<\/table>)/gi,
    (_, captionRaw, tableHtml) => handleTableCaption(captionRaw, tableHtml)
  );

  return processed;
}
