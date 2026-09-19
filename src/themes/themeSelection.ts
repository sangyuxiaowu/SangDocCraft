import type { CoverListItem, DocumentMeta, DocumentTheme, FooterConfig, HeaderConfig } from '../types';

/**
 * 切换交付规范主题时，只替换排版与配色类参数；
 * 以下属于「文档自身内容」的文本类信息，当前主题已有值时一律保留：
 * - meta: title、subtitle、author、version、department、organization、date、number、coverlist
 * - header / footer: leftText、centerText、rightText
 */
function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasCoverList(value: CoverListItem[] | undefined): value is CoverListItem[] {
  return Array.isArray(value) && value.length > 0;
}

function keepExistingText(current: string | undefined, incoming: string | undefined): string | undefined {
  return hasText(current) ? current : incoming;
}

function mergeMeta(current: DocumentMeta, incoming: DocumentMeta): DocumentMeta {
  const merged: DocumentMeta = {
    ...incoming,
    title: keepExistingText(current.title, incoming.title) ?? '',
    subtitle: keepExistingText(current.subtitle, incoming.subtitle) ?? '',
    author: keepExistingText(current.author, incoming.author) ?? '',
    department: keepExistingText(current.department, incoming.department) ?? '',
    organization: keepExistingText(current.organization, incoming.organization) ?? '',
    date: keepExistingText(current.date, incoming.date) ?? '',
    version: keepExistingText(current.version, incoming.version),
    number: keepExistingText(current.number, incoming.number),
  };

  if (hasCoverList(current.coverlist)) {
    merged.coverlist = current.coverlist;
  }

  return merged;
}

function mergeHeader(current: HeaderConfig, incoming: HeaderConfig): HeaderConfig {
  return {
    ...incoming,
    leftText: keepExistingText(current.leftText, incoming.leftText) ?? '',
    centerText: keepExistingText(current.centerText, incoming.centerText) ?? '',
    rightText: keepExistingText(current.rightText, incoming.rightText) ?? '',
  };
}

function mergeFooter(current: FooterConfig, incoming: FooterConfig): FooterConfig {
  return {
    ...incoming,
    leftText: keepExistingText(current.leftText, incoming.leftText) ?? '',
    centerText: keepExistingText(current.centerText, incoming.centerText) ?? '',
    rightText: keepExistingText(current.rightText, incoming.rightText) ?? '',
  };
}

/**
 * 应用新主题：排版、配色等配置完全沿用新主题，封面与页眉页脚的文本类信息保留当前文档已有值。
 */
export function mergeThemePreservingDocumentText(current: DocumentTheme, incoming: DocumentTheme): DocumentTheme {
  return {
    ...incoming,
    meta: mergeMeta(current.meta, incoming.meta),
    header: mergeHeader(current.header, incoming.header),
    footer: mergeFooter(current.footer, incoming.footer),
  };
}
