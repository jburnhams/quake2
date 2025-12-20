import 'fake-indexeddb/auto';

/**
 * Creates a mock Storage implementation (localStorage/sessionStorage).
 */
export function createMockLocalStorage(initialData: Record<string, string> = {}): Storage {
  const storage = new Map<string, string>(Object.entries(initialData));

  return {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (index: number) => Array.from(storage.keys())[index] || null,
    get length() { return storage.size; },
  } as Storage;
}

export function createMockSessionStorage(initialData: Record<string, string> = {}): Storage {
  return createMockLocalStorage(initialData);
}

/**
 * Creates a mock IndexedDB factory.
 * Since we imported 'fake-indexeddb/auto', global.indexedDB is already mocked.
 * This helper returns it or allows custom setup if needed.
 */
export function createMockIndexedDB(databases: IDBDatabase[] = []): IDBFactory {
  // fake-indexeddb handles most of this automatically.
  // If we needed to inject specific databases, we would open them here.
  return global.indexedDB;
}

export interface StorageScenario {
  localStorage: Storage;
  sessionStorage: Storage;
  indexedDB: IDBFactory;
  reset(): void;
  populate(data: Record<string, string>): Promise<void> | void;
  verify(key: string, value: string): Promise<boolean> | boolean;
}

/**
 * Creates a comprehensive storage test scenario.
 */
export function createStorageTestScenario(type: 'local' | 'session' | 'indexed'): StorageScenario {
  const mockLocal = createMockLocalStorage();
  const mockSession = createMockSessionStorage();

  // Apply to global for the duration of the test if this helper is used to setup env
  // Note: fake-indexeddb is auto-applied globally on import

  global.localStorage = mockLocal;
  global.sessionStorage = mockSession;

  return {
    localStorage: mockLocal,
    sessionStorage: mockSession,
    indexedDB: global.indexedDB,
    reset() {
      mockLocal.clear();
      mockSession.clear();
    },
    populate(data: Record<string, string>) {
        if (type === 'local') {
            Object.entries(data).forEach(([k, v]) => mockLocal.setItem(k, v));
        } else if (type === 'session') {
            Object.entries(data).forEach(([k, v]) => mockSession.setItem(k, v));
        } else if (type === 'indexed') {
             // Basic indexedDB population logic for test
             // This is complex, assume simple key-val store for demo
             return new Promise<void>((resolve, reject) => {
                 const req = global.indexedDB.open('test-db', 1);
                 req.onupgradeneeded = (e: any) => {
                     const db = e.target.result;
                     db.createObjectStore('store');
                 };
                 req.onsuccess = (e: any) => {
                     const db = e.target.result;
                     const tx = db.transaction('store', 'readwrite');
                     const store = tx.objectStore('store');
                     Object.entries(data).forEach(([k, v]) => store.put(v, k));
                     tx.oncomplete = () => resolve();
                     tx.onerror = () => reject(tx.error);
                 };
             });
        }
    },
    verify(key: string, value: string) {
        if (type === 'local') {
            return mockLocal.getItem(key) === value;
        } else if (type === 'session') {
            return mockSession.getItem(key) === value;
        } else if (type === 'indexed') {
             return new Promise<boolean>((resolve) => {
                 const req = global.indexedDB.open('test-db', 1);
                 req.onsuccess = (e: any) => {
                     const db = e.target.result;
                     const tx = db.transaction('store', 'readonly');
                     const store = tx.objectStore('store');
                     const getReq = store.get(key);
                     getReq.onsuccess = () => resolve(getReq.result === value);
                     getReq.onerror = () => resolve(false);
                 };
                 req.onerror = () => resolve(false);
             });
        }
        return false;
    }
  };
}
