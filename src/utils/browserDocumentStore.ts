import type { OpenedDocument } from './documentFileOperations';

export interface DocumentFileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  isSameEntry(other: DocumentFileHandle): Promise<boolean>;
  queryPermission(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  createWritable(): Promise<{
    write(data: Blob): Promise<void>;
    close(): Promise<void>;
    abort(): Promise<void>;
  }>;
}

export interface BrowserDocumentFile {
  id: string;
  handle: DocumentFileHandle;
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sangdoccraft-local-files', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('handles', { keyPath: 'id' });
      request.result.createObjectStore('transfers');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function accessStore<T>(
  name: 'handles' | 'transfers', mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(name, mode);
      const request = operation(transaction.objectStore(name));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function rememberBrowserFile(handle: DocumentFileHandle): Promise<BrowserDocumentFile> {
  const files: BrowserDocumentFile[] = await accessStore('handles', 'readonly', store => store.getAll());
  for (const file of files) {
    if (await handle.isSameEntry(file.handle)) {
      const updated = { id: file.id, handle };
      await accessStore('handles', 'readwrite', store => store.put(updated));
      return updated;
    }
  }
  const file = { id: crypto.randomUUID(), handle };
  await accessStore('handles', 'readwrite', store => store.put(file));
  return file;
}

export async function getBrowserFile(id: string): Promise<BrowserDocumentFile> {
  const file: BrowserDocumentFile | undefined = await accessStore('handles', 'readonly', store => store.get(id));
  if (!file) throw new Error('本地文件记录已失效，请重新选择文件。');
  return file;
}

export async function storeDocumentTransfer(opened: OpenedDocument): Promise<string> {
  const id = crypto.randomUUID();
  await accessStore('transfers', 'readwrite', store => store.put(opened, id));
  return id;
}

export async function takeDocumentTransfer(id: string): Promise<OpenedDocument> {
  const opened: OpenedDocument | undefined = await accessStore('transfers', 'readonly', store => store.get(id));
  if (!opened) throw new Error('文档打开请求已过期，请重新打开文件。');
  await deleteDocumentTransfer(id);
  return opened;
}

export async function deleteDocumentTransfer(id: string): Promise<void> {
  await accessStore('transfers', 'readwrite', store => store.delete(id));
}
