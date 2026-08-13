import * as jsYaml from 'js-yaml';
import { marked } from 'marked';
import { TocItem, DocumentMeta, CoverListItem, FooterConfig, StyleConfig, ImageStyleConfig, TableCaptionConfig } from '../types';
import { resolveImageSrc } from './tauriHelper';

export interface ParsedMarkdown {
  raw: string;
  body: string;
  frontmatter: Record<string, any> | null;
  extractedMeta?: Partial<DocumentMeta>;
}

/**
 * Parses YAML frontmatter from top of markdown string (e.g. --- title: xx ---)
 */
export function parseFrontmatter(markdown: string): ParsedMarkdown {
  if (!markdown || typeof markdown !== 'string') {
    return { raw: '', body: '', frontmatter: null };
  }

  const trimmed = markdown.trimStart();
  if (!trimmed.startsWith('---')) {
    return { raw: markdown, body: markdown, frontmatter: null };
  }

  // Find the closing ---
  const match = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { raw: markdown, body: markdown, frontmatter: null };
  }

  const yamlStr = match[1];
  const body = trimmed.slice(match[0].length);

  try {
    // Replace tabs with spaces for YAML compatibility
    const safeYamlStr = yamlStr.replace(/\t/g, '  ');
    const loadYaml = jsYaml.load || (jsYaml as any).default?.load;
    const parsed = loadYaml(safeYamlStr) as Record<string, any>;

    if (parsed && typeof parsed === 'object') {
      const extractedMeta = processFrontmatterData(parsed);
      return {
        raw: markdown,
        body,
        frontmatter: parsed,
        extractedMeta,
      };
    }
  } catch (err) {
    console.warn('YAML Frontmatter parsing warning:', err);
  }

  return { raw: markdown, body: markdown, frontmatter: null };
}

function processFrontmatterData(data: Record<string, any>): Partial<DocumentMeta> {
  const meta: Partial<DocumentMeta> = {};

  if (data.title && typeof data.title === 'string') meta.title = data.title;
  if (data.subtitle && typeof data.subtitle === 'string') meta.subtitle = data.subtitle;
  if (data.author && typeof data.author === 'string') meta.author = String(data.author);
  if (data.organization && typeof data.organization === 'string') meta.organization = String(data.organization);
  if (data.department && typeof data.department === 'string') meta.department = String(data.department);
  if (data.version !== undefined) meta.version = String(data.version);
  if (data.date !== undefined) meta.date = String(data.date);
  if (data.projectName && typeof data.projectName === 'string') meta.projectName = String(data.projectName);
  if (data.number !== undefined) meta.number = String(data.number);

  // logo or logoUrl
  const logoVal = data.logo || data.logoUrl;
  if (logoVal && typeof logoVal === 'string') {
    meta.logo = logoVal;
    meta.logoUrl = logoVal;
  }

  // coverStyle
  if (data.coverStyle || data.style) {
    const styleVal = String(data.coverStyle || data.style).toLowerCase();
    if (['enterprise', 'modern', 'spec', 'minimal', 'creative'].includes(styleVal)) {
      meta.coverStyle = styleVal as any;
    }
  }

  // Parse coverlist
  if (data.coverlist) {
    meta.coverlist = parseCoverList(data.coverlist);
  }

  return meta;
}

function parseCoverList(rawList: any): CoverListItem[] {
  const items: CoverListItem[] = [];

  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      if (!item) continue;

      if (typeof item === 'object') {
        // e.g. - 📁项目名称: Project Hyperion
        // or - { label: "...", value: "..." }
        if (item.label !== undefined && item.value !== undefined) {
          items.push({ label: String(item.label), value: String(item.value) });
        } else {
          // Object key-value pairs
          for (const key of Object.keys(item)) {
            items.push({ label: key, value: String(item[key]) });
          }
        }
      } else if (typeof item === 'string') {
        // e.g. "📁项目名称: Project Hyperion"
        const colonIdx = item.indexOf(':');
        if (colonIdx > -1) {
          const label = item.slice(0, colonIdx).trim();
          const value = item.slice(colonIdx + 1).trim();
          items.push({ label, value });
        } else {
          items.push({ label: item.trim(), value: '' });
        }
      }
    }
  } else if (typeof rawList === 'object') {
    // coverlist: { "📁项目名称": "Project Hyperion", "文档版本": "v1.5" }
    for (const key of Object.keys(rawList)) {
      items.push({ label: key, value: String(rawList[key]) });
    }
  }

  return items;
}

/**
 * Returns merged effective DocumentMeta where frontmatter takes precedence when defined
 */
export function getEffectiveMeta(baseMeta: DocumentMeta, markdown: string): DocumentMeta {
  const parsed = parseFrontmatter(markdown);
  if (!parsed.extractedMeta) return baseMeta;

  const em = parsed.extractedMeta;
  return {
    ...baseMeta,
    title: em.title ?? baseMeta.title,
    subtitle: em.subtitle ?? baseMeta.subtitle,
    author: em.author ?? baseMeta.author,
    organization: em.organization ?? baseMeta.organization,
    department: em.department ?? baseMeta.department,
    projectName: em.projectName ?? baseMeta.projectName,
    version: em.version ?? baseMeta.version,
    date: em.date ?? baseMeta.date,
    logo: em.logo ?? baseMeta.logo,
    logoUrl: em.logoUrl ?? baseMeta.logoUrl,
    number: em.number ?? baseMeta.number,
    coverStyle: em.coverStyle ?? baseMeta.coverStyle,
    coverlist: em.coverlist ?? baseMeta.coverlist,
  };
}

/**
 * Updates or prepends YAML frontmatter in markdown string with given meta values
 */
export function updateMarkdownFrontmatter(markdown: string, meta: DocumentMeta): string {
  const parsed = parseFrontmatter(markdown);
  const body = parsed.body || markdown;

  // Build yaml data object from meta, preserving any extra user frontmatter fields
  const yamlObj: Record<string, any> = { ...(parsed.frontmatter || {}) };

  if (meta.title) yamlObj.title = meta.title; else delete yamlObj.title;
  if (meta.subtitle) yamlObj.subtitle = meta.subtitle; else delete yamlObj.subtitle;
  if (meta.author) yamlObj.author = meta.author; else delete yamlObj.author;
  if (meta.organization) yamlObj.organization = meta.organization; else delete yamlObj.organization;
  if (meta.department) yamlObj.department = meta.department; else delete yamlObj.department;
  if (meta.projectName) yamlObj.projectName = meta.projectName; else delete yamlObj.projectName;
  if (meta.version) yamlObj.version = meta.version; else delete yamlObj.version;
  if (meta.date) yamlObj.date = meta.date; else delete yamlObj.date;
  if (meta.number) yamlObj.number = meta.number; else delete yamlObj.number;

  const logoVal = meta.logo || meta.logoUrl;
  if (logoVal) yamlObj.logo = logoVal; else delete yamlObj.logo;

  if (meta.coverStyle) yamlObj.coverStyle = meta.coverStyle; else delete yamlObj.coverStyle;

  if (meta.coverlist && meta.coverlist.length > 0) {
    yamlObj.coverlist = meta.coverlist.map(item => ({ [item.label]: item.value }));
  } else {
    delete yamlObj.coverlist;
  }

  if (Object.keys(yamlObj).length === 0) {
    return body;
  }

  try {
    const dumpYaml = jsYaml.dump || (jsYaml as any).default?.dump;
    const yamlStr = dumpYaml(yamlObj, {
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
    });
    return `---\n${yamlStr.trim()}\n---\n\n${body.trimStart()}`;
  } catch (e) {
    console.error('Error dumping YAML frontmatter:', e);
    return markdown;
  }
}

export const TOC_ITEMS_PER_PAGE = 22;

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
    const text = item.text || item.raw || '';
    return `${prefix}${text}`;
  }).join('\n');
}

function buildTableMd(header: any[], rows: any[][]): string {
  if (!header || header.length === 0) return '';
  const headerCols = header.map((h: any) => h.text || h.raw || '');
  const headerLine = `| ${headerCols.join(' | ')} |`;
  const alignLine = `| ${headerCols.map(() => '---').join(' | ')} |`;
  const rowLines = rows.map((row: any[]) => {
    const rowCols = row.map((cell: any) => cell.text || cell.raw || '');
    return `| ${rowCols.join(' | ')} |`;
  });
  return [headerLine, alignLine, ...rowLines].join('\n');
}

function buildCodeMd(lines: string[], lang: string = ''): string {
  return `\`\`\`${lang}\n${lines.join('\n')}\n\`\`\``;
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

  const testList = document.createElement(token.ordered ? 'ol' : 'ul');
  measurer.appendChild(testList);

  let fitCount = 0;
  for (let i = 0; i < items.length; i++) {
    const li = document.createElement('li');
    li.innerHTML = marked.parseInline(items[i].text || items[i].raw || '') as string;
    testList.appendChild(li);

    if (measurer.scrollHeight <= maxHeight + 1) {
      fitCount = i + 1;
    } else {
      break;
    }
  }

  measurer.removeChild(testList);

  if (fitCount < 1 || fitCount >= items.length) return null;

  const part1Items = items.slice(0, fitCount);
  const part2Items = items.slice(fitCount);

  return {
    part1Md: buildListMd(part1Items, token.ordered, 1),
    part2Md: buildListMd(part2Items, token.ordered, fitCount + 1),
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
    part1Md: buildTableMd(header, rows.slice(0, fitCount)),
    part2Md: buildTableMd(header, rows.slice(fitCount)),
  };
}

/**
 * Dynamically measures content overflow in DOM layout engine and splits markdown with pixel precision
 */
export function paginateContentByDom(
  markdownText: string,
  options: DomPaginationOptions = {}
): string[] {
  if (typeof document === 'undefined') {
    return splitContentByPages(markdownText, options.h1PageBreak);
  }

  const PAGEBREAK_REGEX = /<!--\s*pagebreak\s*-->|<div[^>]*page-break-after[^>]*><\/div>|<div[^>]*class=["']page-break["'][^>]*><\/div>/i;
  const initialChunks = markdownText.split(PAGEBREAK_REGEX);
  const pages: string[] = [];

  const measurer = document.createElement('div');
  measurer.className = 'markdown-rendered-body';
  measurer.style.position = 'absolute';
  measurer.style.left = '-9999px';
  measurer.style.top = '-9999px';
  measurer.style.visibility = 'hidden';
  measurer.style.pointerEvents = 'none';
  measurer.style.boxSizing = 'border-box';
  measurer.style.width = '170mm'; // A4 content area width: 210mm - 40mm padding
  measurer.style.fontFamily = options.fontFamily || 'sans-serif';
  measurer.style.fontSize = `${options.fontSize || 14}px`;
  measurer.style.lineHeight = `${options.lineHeight || 1.6}`;
  measurer.style.color = options.textColor || '#0f172a';
  measurer.style.setProperty('--primary-color', options.primaryColor || '#1e293b');
  measurer.style.setProperty('--accent-color', options.accentColor || '#2563eb');

  document.body.appendChild(measurer);

  // Height available inside A4 sheet body area:
  // A4 total height at 96dpi = 1122.5px
  // Top padding (20mm = ~75.6px) + Bottom padding (20mm = ~75.6px) = 151.2px
  const headerHeight = options.headerShow ? 38 : 0;
  const footerHeight = options.footerShow ? 38 : 0;
  const maxHeight = 1122.5 - 151.2 - headerHeight - footerHeight - 6; // 6px safety margin

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

        const tempContainer = document.createElement('div');
        const rawTokenHtml = marked.parse(token.raw || '') as string;
        tempContainer.innerHTML = postProcessRenderedHtml(rawTokenHtml);
        measurer.appendChild(tempContainer);

        if (measurer.scrollHeight <= maxHeight) {
          currentPageTokens.push(token.raw);
          return;
        }

        measurer.removeChild(tempContainer);

        if (currentPageTokens.length === 0) {
          if (token.type === 'paragraph') {
            const splitRes = findDomParagraphSplit(token.text || token.raw || '', measurer, maxHeight);
            if (splitRes) {
              currentPageTokens.push(splitRes.part1);
              flushPage();
              processToken({ ...token, type: 'paragraph', text: splitRes.part2, raw: splitRes.part2 });
              return;
            }
          }
          currentPageTokens.push(token.raw);
          const tempC = document.createElement('div');
          tempC.innerHTML = marked.parse(token.raw || '') as string;
          measurer.appendChild(tempC);
          return;
        }

        if (token.type === 'paragraph') {
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
        } else if (token.type === 'code') {
          const splitRes = findDomCodeSplit(token, measurer, maxHeight);
          if (splitRes) {
            currentPageTokens.push(splitRes.part1Md);
            flushPage();
            const newToken = marked.lexer(splitRes.part2Md)[0] || { type: 'raw', raw: splitRes.part2Md };
            processToken(newToken);
            return;
          }
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
  }

  return pages.length > 0 ? pages : [markdownText];
}

export function getTocChunks(items: TocItem[], perPage: number = TOC_ITEMS_PER_PAGE): TocItem[][] {
  if (!items || items.length === 0) return [[]];
  const chunks: TocItem[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    chunks.push(items.slice(i, i + perPage));
  }
  return chunks;
}

/**
 * Extracts H1, H2, H3 headings from markdown to build Table of Contents items with calculated page numbers
 */
export function parseTableOfContents(
  markdown: string, 
  maxDepth: number = 3, 
  meta?: Partial<DocumentMeta>, 
  tocShow: boolean = true,
  h1PageBreak: boolean = false
): TocItem[] {
  const parsed = parseFrontmatter(markdown);
  const contentToParse = parsed.body || markdown;

  const showCover = meta?.showCover !== false;
  const showToc = tocShow !== false;

  const contentPages = splitContentByPages(contentToParse, h1PageBreak);

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
          text: token.text,
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
export function splitContentByPages(markdown: string, h1PageBreak: boolean = false): string[] {
  const parsed = parseFrontmatter(markdown);
  const contentToSplit = (parsed.body || markdown).trim();
  if (!contentToSplit) return [''];

  const PAGEBREAK_REGEX = /<!--\s*pagebreak\s*-->|<div[^>]*page-break-after[^>]*><\/div>|<div[^>]*class=["']page-break["'][^>]*><\/div>/i;
  const initialChunks = contentToSplit.split(PAGEBREAK_REGEX);

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

    const secondEff = getEffectiveCharLength(secondText);
    const secondLines = Math.max(1, Math.ceil(secondEff / 41));

    return {
      firstRaw: firstText,
      secondRaw: `<p class="p-continuation">${secondText}</p>`,
      secondUnits: secondLines * 1.0 + 0.2,
    };
  };

  // Helper to split a long table token
  const splitTable = (token: any, availUnits: number) => {
    const headers = token.header || [];
    const rows = token.rows || [];
    if (rows.length <= 1) return null;

    const fitRowsCount = Math.floor((availUnits - 0.5) / 1.05);
    if (fitRowsCount < 1 || fitRowsCount >= rows.length) return null;

    const part1Rows = rows.slice(0, fitRowsCount);
    const part2Rows = rows.slice(fitRowsCount);

    const buildMdTable = (tableHeaders: any[], tableRows: any[]) => {
      const headerLine = '| ' + tableHeaders.map((h: any) => (typeof h === 'string' ? h : h.text || '')).join(' | ') + ' |';
      const alignLine = '| ' + tableHeaders.map(() => '---').join(' | ') + ' |';
      const rowLines = tableRows.map((r: any[]) => '| ' + r.map((c: any) => (typeof c === 'string' ? c : c.text || '')).join(' | ') + ' |');
      return [headerLine, alignLine, ...rowLines].join('\n');
    };

    const firstTableRaw = buildMdTable(headers, part1Rows);
    const secondTableRaw = buildMdTable(headers, part2Rows);

    return {
      firstRaw: firstTableRaw,
      secondRaw: secondTableRaw,
      secondUnits: (part2Rows.length + 1) * 1.05 + 0.5,
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
      secondUnits: secondLines.length * 0.77 + 0.8,
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

    const ordered = token.ordered;
    const buildMdList = (listItems: any[], startIdx: number) => {
      return listItems.map((item: any, idx: number) => {
        const prefix = ordered ? `${startIdx + idx}. ` : '- ';
        const rawText = item.text || item.raw || '';
        return `${prefix}${rawText}`;
      }).join('\n');
    };

    const remainingLines = part2Items.reduce((acc: number, item: any) => {
      const itemText = item.text || item.raw || '';
      return acc + Math.max(1, Math.ceil(getEffectiveCharLength(itemText) / 38));
    }, 0);

    return {
      firstRaw: buildMdList(part1Items, 1),
      secondRaw: buildMdList(part2Items, fitCount + 1),
      secondUnits: remainingLines * 0.9 + 0.3,
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

    tokens.forEach((token) => {
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

      if (token.type === 'paragraph') {
        const splitRes = splitParagraph(token.text || token.raw || '', availUnits);
        if (splitRes) {
          currentPageTokens.push(splitRes.firstRaw);
          flushPage();
          currentPageTokens.push(splitRes.secondRaw);
          currentUnits = splitRes.secondUnits;
          return;
        }
      } else if (token.type === 'table') {
        const splitRes = splitTable(token, availUnits);
        if (splitRes) {
          currentPageTokens.push(splitRes.firstRaw);
          flushPage();
          currentPageTokens.push(splitRes.secondRaw);
          currentUnits = splitRes.secondUnits;
          return;
        }
      } else if (token.type === 'code') {
        const splitRes = splitCode(token, availUnits);
        if (splitRes) {
          currentPageTokens.push(splitRes.firstRaw);
          flushPage();
          currentPageTokens.push(splitRes.secondRaw);
          currentUnits = splitRes.secondUnits;
          return;
        }
      } else if (token.type === 'list') {
        const splitRes = splitList(token, availUnits);
        if (splitRes) {
          currentPageTokens.push(splitRes.firstRaw);
          flushPage();
          currentPageTokens.push(splitRes.secondRaw);
          currentUnits = splitRes.secondUnits;
          return;
        }
      }

      // Default overflow behavior if block cannot be split or availUnits is too small:
      // Flush current page and start a new page with the full block
      if (currentPageTokens.length > 0) {
        flushPage();
      }
      currentPageTokens.push(token.raw);
      currentUnits = tokenUnits;
    });

    flushPage();
  });

  return pages.length > 0 ? pages : [contentToSplit];
}

/**
 * Formats current and total page numbers based on the pageNumberFormat setting
 */
export function formatPageNumber(current: number, total: number, format: string): string {
  if (!format || format === 'none') {
    return '';
  }
  if (format === 'pageOfTotal') {
    return `第 ${current} 页 / 共 ${total} 页`;
  }
  if (format === 'page') {
    return `第 ${current} 页`;
  }
  if (format === 'hyphen' || format === 'dash') {
    return `- ${current} -`;
  }
  if (format === 'simple') {
    return `${current} / ${total}`;
  }
  if (format === 'english') {
    return `Page ${current} of ${total}`;
  }
  return `第 ${current} 页 / 共 ${total} 页`;
}

/**
 * Computes left, center, and right footer slot contents based on page number position and footer text configs
 */
export function getFooterSlots(pageNum: number, totalPages: number, footer: FooterConfig, meta: DocumentMeta) {
  const pageStr = formatPageNumber(pageNum, totalPages, footer.pageNumberFormat);
  const pos = footer.pageNumberPosition || 'right';

  let left = footer.leftText || meta.organization || '';
  let center = footer.centerText || '';
  let right = footer.rightText || '';

  if (pageStr) {
    if (pos === 'left') {
      left = left ? `${left} \u00A0\u00A0 ${pageStr}` : pageStr;
    } else if (pos === 'center') {
      center = pageStr;
    } else {
      // right
      right = right ? `${right} \u00A0\u00A0 ${pageStr}` : pageStr;
    }
  }

  return { left, center, right };
}

/**
 * Preprocesses markdown text to detect table captions and inject markers before table HTML
 */
export function preprocessMarkdownCaptions(markdownText: string): string {
  if (!markdownText) return '';

  const lines = markdownText.split('\n');
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';

    const isNextLineTable = nextLine.startsWith('|');

    if (isNextLineTable) {
      // 1) <!-- caption: XXX --> or <!-- table-caption: XXX -->
      const commentMatch = line.match(/^<!--\s*(?:table-)?caption:\s*(.*?)\s*-->$/i);
      // 2) Table: XXX or 表: XXX or 表 1: XXX or 表1: XXX
      const tablePrefixMatch = line.match(/^(?:Table|表)\s*\d*[:：]?\s*(.+)$/i);
      // 3) [表 1: XXX] or [Table 1: XXX]
      const bracketMatch = line.match(/^\[(?:Table|表)\s*\d*[:：]?\s*(.+)\]$/i);

      const matchedCaption = commentMatch?.[1] || bracketMatch?.[1] || (tablePrefixMatch && !line.startsWith('|') ? tablePrefixMatch[1] : null);

      if (matchedCaption) {
        processedLines.push(`<div class="doc-table-caption-hook" data-caption="${escapeHtmlAttr(matchedCaption)}"></div>`);
        continue;
      }
    }

    processedLines.push(lines[i]);
  }

  return processedLines.join('\n');
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
  let processed = html.replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)\/?>/gi, (match, p1, rawSrc, p2) => {
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

    return `<figure class="doc-image-figure" style="text-align: ${imgConfig.captionAlign}; margin: 1.2em auto;">
      <img src="${resolvedSrc}" alt="${rawAlt || 'Image'}" class="doc-image ${borderClass}" style="max-width: 100%; height: auto; display: inline-block;" />
      ${captionHtml}
    </figure>`;
  });

  // 2. Process Tables and Table Captions
  processed = processed.replace(
    /<div\s+class=["']doc-table-caption-hook["']\s+data-caption=["']([^"']*)["']><\/div>\s*(<table[\s\S]*?<\/table>)/gi,
    (_, captionRaw, tableHtml) => {
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
    }
  );

  return processed;
}
