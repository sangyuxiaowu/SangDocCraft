import { marked } from 'marked';
import type { DocumentMeta, CoverListItem } from '../types';

export interface SectionNames {
  h1: string;
  h2: string;
}

const META_KEYS = ['title', 'subtitle', 'author', 'department', 'organization', 'date', 'number', 'version'] as const;

export function resolveDynamicText(text: string, meta: DocumentMeta, section?: SectionNames): string {
  const key = /^@([a-z][a-z0-9]*)$/.exec(text)?.[1];
  if (section && key === 'h1') return section.h1;
  if (section && key === 'h2') return section.h2 || section.h1;
  if (META_KEYS.includes(key as typeof META_KEYS[number])) return meta[key as typeof META_KEYS[number]] ?? '';
  return text;
}

export function resolveCoverList(items: CoverListItem[], meta: DocumentMeta): CoverListItem[] {
  return items.map((item) => ({ ...item, value: resolveDynamicText(item.value, meta) }));
}

export function getPageSections(pages: string[]): SectionNames[] {
  let h1 = '';
  let h2 = '';
  return pages.map((page) => {
    const headings = marked.lexer(page).filter((token) => token.type === 'heading' && token.depth <= 2);
    for (const heading of headings) {
      if (heading.type !== 'heading') continue;
      const text = heading.text.replace(/<[^>]*>/g, '').replace(/\*\*|__|\*|_/g, '').trim();
      if (heading.depth === 1) {
        h1 = text;
        h2 = '';
      } else {
        h2 = text;
      }
    }
    return { h1, h2 };
  });
}