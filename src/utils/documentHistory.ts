import { strToU8 } from 'fflate';
import type { DocumentHistoryEntry, DocumentMeta, DocumentTheme } from '../types';
import { sha256Hex } from './documentPackage';

export async function createHistoryEntry(
  markdown: string,
  meta: DocumentMeta,
  theme: DocumentTheme,
  reason: DocumentHistoryEntry['reason'],
): Promise<DocumentHistoryEntry> {
  const createdAt = new Date().toISOString();
  const contentHash = await sha256Hex(strToU8(JSON.stringify({ markdown, meta, theme })));
  return {
    id: `${createdAt}-${contentHash.slice(0, 12)}`,
    createdAt,
    reason,
    contentHash,
    markdown,
    meta: structuredClone(meta),
    theme: structuredClone(theme),
  };
}

export function appendUniqueHistory(
  history: DocumentHistoryEntry[],
  entry: DocumentHistoryEntry,
  limit = 50,
): DocumentHistoryEntry[] {
  if (history.at(-1)?.contentHash === entry.contentHash) return history;
  return [...history, entry].slice(-limit);
}