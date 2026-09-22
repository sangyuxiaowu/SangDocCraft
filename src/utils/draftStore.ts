import type { DocumentHistoryEntry, DocumentSettings, DocumentTheme } from '../types';
import { PRESET_THEMES } from '../data/presetThemes';
import { CURRENT_DOCUMENT_FORMAT_VERSION, migrateDocumentData } from './documentMigrations';
import {
  clearDocumentAssets,
  cleanupOrphanDocumentAssets,
  clearDocumentChatSessions,
  cleanupOrphanChatSessions,
} from './imageRepository';

const DATABASE_NAME = 'sangdoccraft-drafts';
const STORE_NAME = 'drafts';
export const CURRENT_DRAFT_FORMAT_VERSION = CURRENT_DOCUMENT_FORMAT_VERSION;

export interface DocumentDraft {
  formatVersion: typeof CURRENT_DRAFT_FORMAT_VERSION;
  documentId: string;
  createdAt: string;
  updatedAt: string;
  path?: string;
  markdown: string;
  theme: DocumentTheme;
  settings: DocumentSettings;
  history: DocumentHistoryEntry[];
  savedToSdc?: boolean;
}

interface StoredDocumentDraft extends Omit<DocumentDraft, 'formatVersion' | 'theme' | 'history'> {
  formatVersion?: number;
  theme: unknown;
  history?: DocumentHistoryEntry[];
}

export interface DocumentDraftSummary {
  documentId: string;
  updatedAt: string;
  title: string;
  themeName: string;
  charCount: number;
  lineCount: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'documentId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getStoredDrafts(): Promise<StoredDocumentDraft[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  return requestResult(transaction.objectStore(STORE_NAME).getAll()) as Promise<StoredDocumentDraft[]>;
}

function migrateStoredDraft(stored: StoredDocumentDraft): { draft: DocumentDraft; needsWrite: boolean } {
  const fromVersion = stored.formatVersion ?? 1;
  let recovered = false;
  let migrated: Pick<DocumentDraft, 'theme' | 'history'>;
  try {
    migrated = migrateDocumentData(fromVersion, {
      theme: stored.theme as DocumentTheme,
      history: stored.history ?? [],
    });
  } catch (error) {
    recovered = true;
    console.error(`Draft ${stored.documentId} theme migration failed, using the default theme:`, error);
    migrated = {
      theme: structuredClone(PRESET_THEMES[0]),
      history: [],
    };
  }

  return {
    draft: {
      ...stored,
      ...migrated,
      formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
    },
    needsWrite: recovered || stored.formatVersion !== CURRENT_DOCUMENT_FORMAT_VERSION,
  };
}

function summarizeDraft(stored: StoredDocumentDraft): DocumentDraftSummary {
  const markdown = typeof stored.markdown === 'string' ? stored.markdown : '';
  const rawTheme = stored.theme && typeof stored.theme === 'object'
    ? stored.theme as { name?: unknown; meta?: { title?: unknown } }
    : undefined;
  const metaTitle = typeof rawTheme?.meta?.title === 'string' ? rawTheme.meta.title.trim() : '';
  const markdownTitle = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || '';
  return {
    documentId: stored.documentId,
    updatedAt: stored.updatedAt,
    title: metaTitle && metaTitle !== '未命名文档' ? metaTitle : markdownTitle || '未命名草稿',
    themeName: typeof rawTheme?.name === 'string' ? rawTheme.name : '默认主题',
    charCount: markdown.length,
    lineCount: markdown ? markdown.split('\n').length : 0,
  };
}

export async function saveDraft(draft: DocumentDraft): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  await requestResult(transaction.objectStore(STORE_NAME).put({
    ...draft,
    formatVersion: CURRENT_DOCUMENT_FORMAT_VERSION,
  }));
}

export async function getDraft(documentId: string): Promise<DocumentDraft | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const stored = await requestResult(transaction.objectStore(STORE_NAME).get(documentId)) as StoredDocumentDraft | undefined;
  if (!stored) return undefined;
  const { draft, needsWrite } = migrateStoredDraft(stored);
  if (needsWrite) await saveDraft(draft);
  return draft;
}

export async function deleteDraft(documentId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).delete(documentId);
}

export async function getAllDrafts(): Promise<DocumentDraft[]> {
  const storedDrafts = await getStoredDrafts();
  const migratedDrafts = storedDrafts.map(migrateStoredDraft);
  await Promise.all(migratedDrafts.map(({ draft, needsWrite }) => needsWrite ? saveDraft(draft) : Promise.resolve()));
  const drafts = migratedDrafts.map(({ draft }) => draft);
  return drafts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getUnsavedDrafts(): Promise<DocumentDraft[]> {
  const drafts = await getAllDrafts();
  // Filter out drafts that were already exported/saved to .sdc file
  return drafts.filter((d) => !d.savedToSdc);
}

export async function getUnsavedDraftSummaries(): Promise<DocumentDraftSummary[]> {
  const drafts = await getStoredDrafts();
  return drafts
    .filter((draft) => !draft.savedToSdc)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(summarizeDraft);
}

export async function markDraftSaved(documentId: string, saved = true): Promise<void> {
  const draft = await getDraft(documentId);
  if (!draft) return;
  draft.savedToSdc = saved;
  await saveDraft(draft);
}

export async function clearAllDrafts(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).clear();
}

/**
 * 彻底删除草稿以及其归属的所有图片资产与对话记录，不留任何孤立垃圾
 */
export async function deleteDraftWithAssets(documentId: string): Promise<void> {
  await deleteDraft(documentId);
  await clearDocumentAssets(documentId);
  await clearDocumentChatSessions(documentId);
}

/**
 * 清空草稿及关联图片与对话（可选择保留当前正在编辑的 activeDocumentId）
 */
export async function clearAllDraftsWithAssets(preserveDocumentId?: string): Promise<void> {
  const drafts = await getStoredDrafts();
  for (const draft of drafts) {
    if (draft.documentId !== preserveDocumentId) {
      await deleteDraft(draft.documentId);
      await clearDocumentAssets(draft.documentId);
      await clearDocumentChatSessions(draft.documentId);
    }
  }
  if (!preserveDocumentId) {
    await clearAllDrafts();
  }
}

/**
 * 全局存储垃圾回收 (GC):
 * 收集当前所有未删除的草稿 IDs 以及当前活跃文档 ID
 * 清理图片库与对话库中所有属于未知/已删文档的孤立残留数据
 */
export async function runStorageGC(activeDocumentId?: string): Promise<number> {
  const drafts = await getStoredDrafts();
  const validIds = new Set<string>(drafts.map((d) => d.documentId));
  if (activeDocumentId) {
    validIds.add(activeDocumentId);
  }
  const [cleanedAssets, cleanedChats] = await Promise.all([
    cleanupOrphanDocumentAssets(validIds),
    cleanupOrphanChatSessions(validIds),
  ]);
  return cleanedAssets + cleanedChats;
}

export async function getLatestDraft(): Promise<DocumentDraft | undefined> {
  const drafts = await getAllDrafts();
  return drafts[0];
}