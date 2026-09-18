const DATABASE_NAME = 'sangdoccraft-ai-secrets';
const DATABASE_VERSION = 1;
const KEY_STORE = 'encryption-key';
const SECRET_STORE = 'endpoint-secrets';
const MASTER_KEY_ID = 'master';

interface EncryptedSecret {
  endpointId: string;
  iv: Uint8Array;
  ciphertext: Uint8Array;
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
      if (!database.objectStoreNames.contains(KEY_STORE)) database.createObjectStore(KEY_STORE);
      if (!database.objectStoreNames.contains(SECRET_STORE)) database.createObjectStore(SECRET_STORE, { keyPath: 'endpointId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const database = await openDatabase();
  const readTransaction = database.transaction(KEY_STORE, 'readonly');
  const existing = await requestResult(readTransaction.objectStore(KEY_STORE).get(MASTER_KEY_ID)) as CryptoKey | undefined;
  if (existing) return existing;

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const writeTransaction = database.transaction(KEY_STORE, 'readwrite');
  writeTransaction.objectStore(KEY_STORE).put(key, MASTER_KEY_ID);
  await transactionDone(writeTransaction);
  return key;
}

export async function saveApiKeys(apiKeys: Map<string, string>): Promise<void> {
  const key = await getEncryptionKey();
  const encrypted = await Promise.all([...apiKeys].map(async ([endpointId, apiKey]): Promise<EncryptedSecret> => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(apiKey));
    return { endpointId, iv, ciphertext: new Uint8Array(ciphertext) };
  }));

  const database = await openDatabase();
  const transaction = database.transaction(SECRET_STORE, 'readwrite');
  const store = transaction.objectStore(SECRET_STORE);
  store.clear();
  encrypted.forEach(secret => store.put(secret));
  await transactionDone(transaction);
}

export async function loadApiKeys(): Promise<Map<string, string>> {
  const database = await openDatabase();
  const transaction = database.transaction(SECRET_STORE, 'readonly');
  const records = await requestResult(transaction.objectStore(SECRET_STORE).getAll()) as EncryptedSecret[];
  if (!records.length) return new Map();

  const key = await getEncryptionKey();
  const entries = await Promise.all(records.map(async (record): Promise<[string, string]> => {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, key, record.ciphertext);
    return [record.endpointId, new TextDecoder().decode(plaintext)];
  }));
  return new Map(entries);
}