import type { DocumentHistoryEntry, DocumentSettings, DocumentTheme } from '../types';
import {
  clearDocumentAssets,
  cleanupOrphanDocumentAssets,
  clearDocumentChatSessions,
  cleanupOrphanChatSessions,
} from './imageRepository';

const DATABASE_NAME = 'sangdoccraft-drafts';
const STORE_NAME = 'drafts';

export interface DocumentDraft {
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

export async function saveDraft(draft: DocumentDraft): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).put(draft);
}

export async function getDraft(documentId: string): Promise<DocumentDraft | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  return requestResult(transaction.objectStore(STORE_NAME).get(documentId));
}

export async function deleteDraft(documentId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).delete(documentId);
}

export async function getAllDrafts(): Promise<DocumentDraft[]> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const drafts = await requestResult(transaction.objectStore(STORE_NAME).getAll()) as DocumentDraft[];
  return drafts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getUnsavedDrafts(): Promise<DocumentDraft[]> {
  const drafts = await getAllDrafts();
  // Filter out drafts that were already exported/saved to .sdc file
  return drafts.filter((d) => !d.savedToSdc);
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
  const drafts = await getAllDrafts();
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
  const drafts = await getAllDrafts();
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