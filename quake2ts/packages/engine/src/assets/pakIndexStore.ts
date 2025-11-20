import { PakArchive, type PakDirectoryEntry, type PakValidationResult, normalizePath } from './pak.js';

const DEFAULT_DB_NAME = 'quake2ts-pak-indexes';
const DEFAULT_STORE_NAME = 'pak-indexes';

export interface StoredPakIndex extends PakValidationResult {
  readonly key: string;
  readonly name: string;
  readonly size: number;
  readonly persistedAt: number;
}

function getIndexedDb(): IDBFactory | undefined {
  if (typeof indexedDB !== 'undefined') {
    return indexedDB;
  }
  if (typeof window !== 'undefined' && 'indexedDB' in window) {
    return window.indexedDB;
  }
  if (typeof globalThis !== 'undefined' && 'indexedDB' in globalThis) {
    return (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB;
  }
  return undefined;
}

function openDatabase(dbName: string, storeName: string): Promise<IDBDatabase> {
  const idb = getIndexedDb();
  if (!idb) {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = idb.open(dbName, 1);

    request.onupgradeneeded = () => {
      const { result } = request;
      if (!result.objectStoreNames.contains(storeName)) {
        result.createObjectStore(storeName, { keyPath: 'key' });
      }
    };

    request.onerror = () => reject(request.error ?? new Error('Unknown IndexedDB error'));
    request.onsuccess = () => resolve(request.result);
  });
}

function runTransaction<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = runner(store);

    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB transaction error'));
  });
}

function buildKey(name: string, checksum: number): string {
  return `${normalizePath(name)}:${checksum.toString(16)}`;
}

function cloneEntries(entries: readonly PakDirectoryEntry[]): PakDirectoryEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

export class PakIndexStore {
  constructor(
    private readonly dbName = DEFAULT_DB_NAME,
    private readonly storeName = DEFAULT_STORE_NAME,
  ) {}

  get isSupported(): boolean {
    return Boolean(getIndexedDb());
  }

  async persist(archive: PakArchive): Promise<StoredPakIndex | undefined> {
    if (!this.isSupported) {
      return undefined;
    }

    const validation = archive.validate();
    const record: StoredPakIndex = {
      ...validation,
      key: buildKey(archive.name, validation.checksum),
      name: archive.name,
      size: archive.size,
      persistedAt: Date.now(),
      entries: cloneEntries(validation.entries),
    };

    const db = await openDatabase(this.dbName, this.storeName);
    await runTransaction(db, this.storeName, 'readwrite', (store) => store.put(record));
    db.close();
    return record;
  }

  async find(name: string, checksum?: number): Promise<StoredPakIndex | undefined> {
    if (!this.isSupported) {
      return undefined;
    }
    const db = await openDatabase(this.dbName, this.storeName);
    const key = checksum !== undefined ? buildKey(name, checksum) : undefined;

    const record = await runTransaction(db, this.storeName, 'readonly', (store) => {
      if (key) {
        return store.get(key);
      }
      return store.getAll();
    });

    db.close();

    if (!record) {
      return undefined;
    }

    if (Array.isArray(record)) {
      const normalized = normalizePath(name);
      const matches = record.filter((candidate: StoredPakIndex) => normalizePath(candidate.name) === normalized);
      if (matches.length === 0) {
        return undefined;
      }
      return matches.sort((a, b) => b.persistedAt - a.persistedAt)[0];
    }

    return record as StoredPakIndex;
  }

  async remove(name: string, checksum?: number): Promise<boolean> {
    if (!this.isSupported) {
      return false;
    }
    const db = await openDatabase(this.dbName, this.storeName);
    const key = checksum !== undefined ? buildKey(name, checksum) : undefined;
    const result = await runTransaction(db, this.storeName, 'readwrite', (store) => {
      if (key) {
        return store.delete(key);
      }
      const prefix = `${normalizePath(name)}:`;
      return store.delete(IDBKeyRange.bound(prefix, `${prefix}￿`, false, true));
    });
    db.close();
    return typeof result === 'number' ? result > 0 : true;
  }

  async clear(): Promise<void> {
    if (!this.isSupported) {
      return;
    }
    const db = await openDatabase(this.dbName, this.storeName);
    await runTransaction(db, this.storeName, 'readwrite', (store) => store.clear());
    db.close();
  }

  async list(): Promise<StoredPakIndex[]> {
    if (!this.isSupported) {
      return [];
    }
    const db = await openDatabase(this.dbName, this.storeName);
    const result = await runTransaction(db, this.storeName, 'readonly', (store) => store.getAll());
    db.close();
    return (result as StoredPakIndex[]).sort((a, b) => b.persistedAt - a.persistedAt);
  }
}
