/**
 * Helper to create a storage-like object (localStorage/sessionStorage).
 */
function createStorageMock(initialData: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(initialData));

  return {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, value.toString()),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] || null,
    get length() { return store.size; }
  } as Storage;
}

/**
 * Creates a mock LocalStorage instance.
 */
export function createMockLocalStorage(initialData: Record<string, string> = {}): Storage {
  return createStorageMock(initialData);
}

/**
 * Creates a mock SessionStorage instance.
 */
export function createMockSessionStorage(initialData: Record<string, string> = {}): Storage {
  return createStorageMock(initialData);
}

/**
 * Creates a mock IndexedDB factory.
 * Wraps fake-indexeddb.
 */
export function createMockIndexedDB(databases?: IDBDatabase[]): IDBFactory {
  // fake-indexeddb/auto already sets global.indexedDB
  // If we need to return a specific instance or customized one, we can do it here.
  // For now, return the global one or a fresh 'fake-indexeddb' instance if we were to import it directly.

  // Since we imported 'fake-indexeddb/auto' in setup/browser.ts, global.indexedDB is already mocked.
  // We can return that.
  return global.indexedDB;
}

export interface StorageScenario {
  localStorage: Storage;
  sessionStorage: Storage;
  indexedDB: IDBFactory;
}

/**
 * Creates a complete storage test scenario.
 */
export function createStorageTestScenario(storageType: 'local' | 'session' | 'indexed' = 'local'): StorageScenario {
  return {
    localStorage: createMockLocalStorage(),
    sessionStorage: createMockSessionStorage(),
    indexedDB: createMockIndexedDB()
  };
}
