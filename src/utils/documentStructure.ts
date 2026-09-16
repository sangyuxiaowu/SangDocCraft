import { DocumentMeta, FooterConfig, TocConfig, TocItem } from '../types';

export const TOC_ITEMS_PER_PAGE = 22;

export function getTocChunks(items: TocItem[], perPage: number = TOC_ITEMS_PER_PAGE): TocItem[][] {
  if (!items || items.length === 0) return [[]];
  const chunks: TocItem[][] = [];
  for (let index = 0; index < items.length; index += perPage) {
    chunks.push(items.slice(index, index + perPage));
  }
  return chunks;
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
    const prefix = counters.slice(0, level).join('.');
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