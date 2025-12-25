// Removed top-level import to avoid side effects
// import 'fake-indexeddb/auto';

/**
 * Creates a mock LocalStorage implementation.
 */
export function createMockLocalStorage(initialData: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(initialData));

  return {
    getItem(key: string) {
      return store.get(key) || null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return Array.from(store.keys())[index] || null;
    },
    get length() {
      return store.size;
    },
  } as Storage;
}

/**
 * Creates a mock SessionStorage implementation (same as LocalStorage for testing).
 */
export function createMockSessionStorage(initialData: Record<string, string> = {}): Storage {
  return createMockLocalStorage(initialData);
}

/**
 * Creates a mock IndexedDB factory.
 * Requires fake-indexeddb to be installed.
 */
export function createMockIndexedDB(): IDBFactory {
    try {
        // Use require to dynamically load if available, ensuring no global pollution unless requested here
        // However, fake-indexeddb exports objects directly.
        // If we want to return a factory without polling global:
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { indexedDB } = require('fake-indexeddb');
        return indexedDB;
    } catch (e) {
        // Fallback to global if already set up
        if (global.indexedDB) return global.indexedDB;
        throw new Error('fake-indexeddb not found. Please install it to use createMockIndexedDB.');
    }
}

export interface StorageScenario {
    storage: Storage | IDBFactory;
    type: 'local' | 'session' | 'indexed';
    reset(): void;
}

export function createStorageTestScenario(type: 'local' | 'session' | 'indexed'): StorageScenario {
    if (type === 'local') {
        const storage = createMockLocalStorage();
        return {
            storage,
            type,
            reset: () => storage.clear()
        };
    } else if (type === 'session') {
        const storage = createMockSessionStorage();
        return {
            storage,
            type,
            reset: () => storage.clear()
        };
    } else {
        // IndexedDB
        const storage = createMockIndexedDB();
        return {
            storage,
            type,
            reset: () => {
                // Hard to reset global indexedDB easily without re-instantiating or deleting databases
                // fake-indexeddb is usually reset by re-importing or using internal APIs if exposed
            }
        };
    }
}
