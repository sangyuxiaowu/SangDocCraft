import { DocumentMeta, FooterConfig, TocConfig, TocItem, TocLevelStyle, TocTitleFont } from '../types';

/** 无 DOM 环境（SSR/单测）的兜底目录分页容量 */
export const TOC_ITEMS_PER_PAGE = 22;

/** 目录页正文可用宽度（A4 210mm - 左右各 15mm） */
export const TOC_CONTENT_WIDTH_MM = 180;

export const DEFAULT_TOC_TITLE_FONT: TocTitleFont = {
  fontFamily: 'inherit',
  fontSize: 22,
  bold: true,
  italic: false,
  underline: false,
  marginBefore: 0,
  marginAfter: 24,
};

export const DEFAULT_TOC_LEVEL_STYLES: TocLevelStyle[] = [
  { fontFamily: 'inherit', fontSize: 14, bold: true, italic: false, underline: false, marginBefore: 0, marginAfter: 10, paddingLeft: 0 },
  { fontFamily: 'inherit', fontSize: 13, bold: false, italic: false, underline: false, marginBefore: 0, marginAfter: 6, paddingLeft: 20 },
  { fontFamily: 'inherit', fontSize: 12, bold: false, italic: false, underline: false, marginBefore: 0, marginAfter: 5, paddingLeft: 40 },
  { fontFamily: 'inherit', fontSize: 12, bold: false, italic: false, underline: false, marginBefore: 0, marginAfter: 4, paddingLeft: 54 },
];

export function getTocChunks<T extends { id: string; text: string; level: number }>(items: T[], perPage: number = TOC_ITEMS_PER_PAGE): T[][] {
  if (!items || items.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += perPage) {
    chunks.push(items.slice(index, index + perPage));
  }
  return chunks;
}

export function getTocTitleFont(toc: TocConfig): TocTitleFont {
  return { ...DEFAULT_TOC_TITLE_FONT, ...(toc.titleFont ?? {}) };
}

export function getTocLevelStyles(toc: TocConfig): TocLevelStyle[] {
  return DEFAULT_TOC_LEVEL_STYLES.map((base, index) => ({ ...base, ...(toc.levelStyles?.[index] ?? {}) }));
}

export function getTocLevelStyle(level: number, toc: TocConfig): TocLevelStyle {
  const styles = getTocLevelStyles(toc);
  const index = Math.min(Math.max(Math.trunc(level) || 1, 1), styles.length) - 1;
  return styles[index];
}

export type TocStyleObject = Record<string, string | number>;

function fontShapeStyle(source: TocTitleFont): TocStyleObject {
  return {
    fontFamily: source.fontFamily || 'inherit',
    fontSize: `${source.fontSize}px`,
    fontWeight: source.bold ? 700 : 400,
    fontStyle: source.italic ? 'italic' : 'normal',
    textDecoration: source.underline ? 'underline' : 'none',
    marginTop: `${source.marginBefore}px`,
    marginBottom: `${source.marginAfter}px`,
  };
}

/** 目录页标题样式（不含配色/边框等由 CSS 主题提供的外观） */
export function getTocTitleStyleObject(toc: TocConfig): TocStyleObject {
  return { ...fontShapeStyle(getTocTitleFont(toc)), lineHeight: '1.35' };
}

/** 单个目录项的行样式（字体、字形、字号、段前段后、缩进） */
export function getTocLevelStyleObject(level: number, toc: TocConfig): TocStyleObject {
  const style = getTocLevelStyle(level, toc);
  return { ...fontShapeStyle(style), paddingLeft: `${style.paddingLeft}px` };
}

export function getTocRowStyleObject(): TocStyleObject {
  return { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' };
}

export function getTocTextStyleObject(): TocStyleObject {
  return { maxWidth: '80%', overflowWrap: 'anywhere', wordBreak: 'break-word' };
}

export function getTocLeaderStyleObject(leaderStyle: TocConfig['leaderStyle']): TocStyleObject {
  const borderStyle = leaderStyle === 'dashes' ? 'dashed' : leaderStyle === 'line' ? 'solid' : 'dotted';
  return { flex: '1 1 auto', margin: '0 8px', height: '1px', borderBottom: `1px ${borderStyle} #cbd5e1` };
}

export function getTocPageNumberStyleObject(): TocStyleObject {
  return { flex: '0 0 auto' };
}

export function styleObjectToCss(style: TocStyleObject): string {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}:${value}`)
    .join(';') + ';';
}

export function getHeadingText(
  text: string,
  level: number,
  counters: number[],
  numbering: TocConfig['headingNumbering'] = 'none'
): string {
  if (numbering === 'none') return text;

  counters[level - 1] += 1;
  for (let index = level; index < counters.length; index += 1) counters[index] = 0;

  if (numbering === 'decimal') {
    return `${counters.slice(0, level).join('.')}. ${text}`;
  }

  if (numbering === 'decimal-skip-h1') {
    if (level === 1) {
      return text;
    }
    // 文档没有一级标题时 counters[0] 恒为 0，直接拼接会出现 "0.1" 这类错误编号，需去掉前导空层级。
    const parts = counters.slice(0, level);
    while (parts.length > 1 && parts[0] === 0) parts.shift();
    const prefix = parts.join('.');
    return text ? `${prefix} ${text}` : prefix;
  }

  const chineseNumerals = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const chineseNumber = (value: number) => value <= 10 ? chineseNumerals[value] : String(value);
  const prefixes = [
    `${chineseNumber(counters[0])}、`,
    `（${chineseNumber(counters[1])}）`,
    `${counters[2]}.`,
    `（${counters[3]}）`,
  ];
  return `${prefixes[level - 1]} ${text}`;
}

export function formatPageNumber(current: number, total: number, format: string): string {
  if (!format || format === 'none') return '';
  if (format === 'pageOfTotal') return `第 ${current} 页 / 共 ${total} 页`;
  if (format === 'page') return `第 ${current} 页`;
  if (format === 'hyphen' || format === 'dash') return `- ${current} -`;
  if (format === 'simple') return `${current} / ${total}`;
  if (format === 'english') return `Page ${current} of ${total}`;
  return `第 ${current} 页 / 共 ${total} 页`;
}

export function getFooterSlots(
  pageNum: number,
  totalPages: number,
  footer: FooterConfig,
  meta: DocumentMeta
) {
  const pageText = formatPageNumber(pageNum, totalPages, footer.pageNumberFormat);
  const position = footer.pageNumberPosition || 'right';

  let left = footer.leftText || meta.organization || '';
  let center = footer.centerText || '';
  let right = footer.rightText || '';

  if (pageText) {
    if (position === 'left') {
      left = left ? `${left} \u00A0\u00A0 ${pageText}` : pageText;
    } else if (position === 'center') {
      center = pageText;
    } else {
      right = right ? `${right} \u00A0\u00A0 ${pageText}` : pageText;
    }
  }

  return { left, center, right };
}