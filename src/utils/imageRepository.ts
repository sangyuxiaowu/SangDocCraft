import type { DocumentAsset } from '../types';

const DATABASE_NAME = 'sangdoccraft-assets';
const DATABASE_VERSION = 1;
const DOCUMENT_STORE = 'document-assets';
const LIBRARY_STORE = 'library-assets';

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