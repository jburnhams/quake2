
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

/**
 * Creates a mock SessionStorage implementation.
 * Functionally identical to LocalStorage mock but distinct for testing isolation.
 */
export function createMockSessionStorage(initialData: Record<string, string> = {}): Storage {
    return createMockLocalStorage(initialData);
}

/**
 * Creates a mock IndexedDB factory.
 * Currently relies on 'fake-indexeddb/auto' being imported which mocks the global indexedDB.
 * This helper ensures the global is available or resets it.
 */
export function createMockIndexedDB(): IDBFactory {
    if (typeof indexedDB === 'undefined') {
        throw new Error('IndexedDB mock not found. Ensure fake-indexeddb is loaded.');
    }
    // In a real mock scenario we might want to return a fresh instance,
    // but fake-indexeddb patches the global.
    return indexedDB;
}

export interface StorageScenario {
    storage: Storage;
    populate(data: Record<string, string>): void;
    verify(key: string, value: string): boolean;
}

/**
 * Helper to setup a storage test scenario.
 */
export function createStorageTestScenario(storageType: 'local' | 'session' = 'local'): StorageScenario {
    const storage = storageType === 'local' ? createMockLocalStorage() : createMockSessionStorage();

    return {
        storage,
        populate(data) {
            Object.entries(data).forEach(([k, v]) => storage.setItem(k, v));
        },
        verify(key, value) {
            return storage.getItem(key) === value;
        }
    };
}
