import type { DocumentHistoryEntry, DocumentSettings, DocumentTheme } from '../types';

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

export async function getLatestDraft(): Promise<DocumentDraft | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const drafts = await requestResult(transaction.objectStore(STORE_NAME).getAll()) as DocumentDraft[];
  return drafts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}