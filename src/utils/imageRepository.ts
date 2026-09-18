import type { DocumentAsset } from '../types';
import type { DocumentChatSession } from '../types/ai';

const DATABASE_NAME = 'sangdoccraft-assets';
const DATABASE_VERSION = 2;
const DOCUMENT_STORE = 'document-assets';
const LIBRARY_STORE = 'library-assets';
const CHAT_STORE = 'document-chat-sessions';

interface StoredDocumentAsset extends DocumentAsset {
  key: string;
  documentId: string;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DOCUMENT_STORE)) {
        const store = database.createObjectStore(DOCUMENT_STORE, { keyPath: 'key' });
        store.createIndex('documentId', 'documentId');
      }
      if (!database.objectStoreNames.contains(LIBRARY_STORE)) {
        database.createObjectStore(LIBRARY_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(CHAT_STORE)) {
        const chatStore = database.createObjectStore(CHAT_STORE, { keyPath: 'id' });
        chatStore.createIndex('documentId', 'documentId');
        chatStore.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
}

export async function putDocumentAsset(documentId: string, asset: DocumentAsset): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(DOCUMENT_STORE, 'readwrite');
  transaction.objectStore(DOCUMENT_STORE).put({
    ...asset,
    scope: 'document',
    documentId,
    key: `${documentId}:${asset.id}`,
  } satisfies StoredDocumentAsset);
  await transactionDone(transaction);
}

export async function listDocumentAssets(documentId: string): Promise<DocumentAsset[]> {
  const database = await openDatabase();
  const transaction = database.transaction(DOCUMENT_STORE, 'readonly');
  const records = await requestResult(transaction.objectStore(DOCUMENT_STORE).index('documentId').getAll(documentId)) as StoredDocumentAsset[];
  return records.map(({ key: _, documentId: __, ...asset }) => asset);
}

export async function putLibraryAsset(asset: DocumentAsset): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(LIBRARY_STORE, 'readwrite');
  transaction.objectStore(LIBRARY_STORE).put({ ...asset, scope: 'library' });
  await transactionDone(transaction);
}

export async function listLibraryAssets(): Promise<DocumentAsset[]> {
  const database = await openDatabase();
  const transaction = database.transaction(LIBRARY_STORE, 'readonly');
  return requestResult(transaction.objectStore(LIBRARY_STORE).getAll());
}

export async function deleteAsset(documentId: string, asset: DocumentAsset): Promise<void> {
  const database = await openDatabase();
  const storeName = asset.scope === 'library' ? LIBRARY_STORE : DOCUMENT_STORE;
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(asset.scope === 'library' ? asset.id : `${documentId}:${asset.id}`);
  await transactionDone(transaction);
}

export async function clearDocumentAssets(documentId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(DOCUMENT_STORE, 'readwrite');
  const store = transaction.objectStore(DOCUMENT_STORE);
  const keys = await requestResult(store.index('documentId').getAllKeys(documentId));
  keys.forEach((key) => store.delete(key));
  await transactionDone(transaction);
}

export async function putChatSession(session: DocumentChatSession): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(CHAT_STORE, 'readwrite');
  transaction.objectStore(CHAT_STORE).put(session);
  await transactionDone(transaction);
}

export async function getChatSession(sessionId: string): Promise<DocumentChatSession | null> {
  const database = await openDatabase();
  const transaction = database.transaction(CHAT_STORE, 'readonly');
  const record = await requestResult(transaction.objectStore(CHAT_STORE).get(sessionId));
  return (record as DocumentChatSession) || null;
}

export async function listChatSessions(documentId: string): Promise<DocumentChatSession[]> {
  const database = await openDatabase();
  const transaction = database.transaction(CHAT_STORE, 'readonly');
  const records = (await requestResult(
    transaction.objectStore(CHAT_STORE).index('documentId').getAll(documentId)
  )) as DocumentChatSession[];
  return (records || []).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(CHAT_STORE, 'readwrite');
  transaction.objectStore(CHAT_STORE).delete(sessionId);
  await transactionDone(transaction);
}

export async function clearDocumentChatSessions(documentId: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(CHAT_STORE, 'readwrite');
  const store = transaction.objectStore(CHAT_STORE);
  const keys = await requestResult(store.index('documentId').getAllKeys(documentId));
  keys.forEach((key) => store.delete(key));
  await transactionDone(transaction);
}

export async function cleanupOrphanChatSessions(validDocumentIds: Set<string>): Promise<number> {
  const database = await openDatabase();
  const transaction = database.transaction(CHAT_STORE, 'readwrite');
  const store = transaction.objectStore(CHAT_STORE);
  const allRecords = (await requestResult(store.getAll())) as DocumentChatSession[];
  let deletedCount = 0;
  for (const record of allRecords) {
    if (!validDocumentIds.has(record.documentId)) {
      store.delete(record.id);
      deletedCount++;
    }
  }
  await transactionDone(transaction);
  return deletedCount;
}

/**
 * 垃圾回收 (Garbage Collection):
 * 扫描 DOCUMENT_STORE，将所有不属于 validDocumentIds 的孤立图片记录彻底删除
 * 返回被清理的孤立图片数量
 */
export async function cleanupOrphanDocumentAssets(validDocumentIds: Set<string>): Promise<number> {
  const database = await openDatabase();
  const transaction = database.transaction(DOCUMENT_STORE, 'readwrite');
  const store = transaction.objectStore(DOCUMENT_STORE);
  const allRecords = (await requestResult(store.getAll())) as StoredDocumentAsset[];
  let deletedCount = 0;
  for (const record of allRecords) {
    if (!validDocumentIds.has(record.documentId)) {
      store.delete(record.key);
      deletedCount++;
    }
  }
  await transactionDone(transaction);
  return deletedCount;
}