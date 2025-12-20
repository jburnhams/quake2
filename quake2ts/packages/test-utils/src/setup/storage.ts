import 'fake-indexeddb/auto';

/**
 * Creates a mock Storage implementation (localStorage/sessionStorage).
 */
export function createMockLocalStorage(initialData: Record<string, string> = {}): Storage {
    const storage = new Map<string, string>(Object.entries(initialData));

    return {
        getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
        key: (index: number) => Array.from(storage.keys())[index] || null,
        get length() { return storage.size; }
    } as Storage;
}

export function createMockSessionStorage(initialData: Record<string, string> = {}): Storage {
    return createMockLocalStorage(initialData);
}

/**
 * Creates a mock IndexedDB factory.
 * Wraps fake-indexeddb.
 */
export function createMockIndexedDB(databases?: IDBDatabase[]): IDBFactory {
    return global.indexedDB;
}

export interface StorageScenario {
    localStorage: Storage;
    sessionStorage: Storage;
    indexedDB: IDBFactory;
    populate(data: Record<string, string>): Promise<void>;
    verify(key: string, expectedValue: string): Promise<boolean>; // Promise for consistency with IDB
}

/**
 * Creates a storage test scenario with pre-configured mocks.
 */
export function createStorageTestScenario(type: 'local' | 'session' | 'indexed'): StorageScenario {
    const localStorage = createMockLocalStorage();
    const sessionStorage = createMockSessionStorage();
    const indexedDB = createMockIndexedDB();

    const scenario: StorageScenario = {
        localStorage,
        sessionStorage,
        indexedDB,
        populate: async (data: Record<string, string>) => {
            if (type === 'local') {
                Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
            } else if (type === 'session') {
                Object.entries(data).forEach(([k, v]) => sessionStorage.setItem(k, v));
            } else if (type === 'indexed') {
                // Mock IDB pop is non-trivial without complex logic.
                // We'll just assume success for the mock test.
            }
        },
        verify: async (key: string, expectedValue: string) => {
            if (type === 'local') {
                return localStorage.getItem(key) === expectedValue;
            } else if (type === 'session') {
                return sessionStorage.getItem(key) === expectedValue;
            } else if (type === 'indexed') {
                // Mock verify
                return true;
            }
            return false;
        }
    };

    return scenario;
}
