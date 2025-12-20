
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
    storage: Storage | IDBFactory;
    populate(data: Record<string, any>): Promise<void> | void;
    verify(key: string, value: any): Promise<boolean> | boolean;
}

/**
 * Helper to setup a storage test scenario.
 */
export function createStorageTestScenario(storageType: 'local' | 'session' | 'indexed' = 'local'): StorageScenario {
    if (storageType === 'indexed') {
        const dbName = `test-db-${Math.random().toString(36).substring(7)}`;
        const storeName = 'test-store';
        const storage = createMockIndexedDB();

        return {
            storage,
            populate: async (data: Record<string, any>) => {
                return new Promise((resolve, reject) => {
                    const req = storage.open(dbName, 1);
                    req.onupgradeneeded = (e: any) => {
                        const db = e.target.result;
                        db.createObjectStore(storeName);
                    };
                    req.onsuccess = (e: any) => {
                        const db = e.target.result;
                        const tx = db.transaction(storeName, 'readwrite');
                        const store = tx.objectStore(storeName);
                        Object.entries(data).forEach(([k, v]) => store.put(v, k));
                        tx.oncomplete = () => {
                            db.close();
                            resolve();
                        };
                        tx.onerror = () => reject(tx.error);
                    };
                    req.onerror = () => reject(req.error);
                });
            },
            verify: async (key: string, value: any) => {
                return new Promise((resolve, reject) => {
                    const req = storage.open(dbName, 1);
                    req.onsuccess = (e: any) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains(storeName)) {
                            db.close();
                            resolve(false);
                            return;
                        }
                        const tx = db.transaction(storeName, 'readonly');
                        const store = tx.objectStore(storeName);
                        const getReq = store.get(key);
                        getReq.onsuccess = () => {
                            const result = getReq.result === value;
                            db.close();
                            resolve(result);
                        };
                        getReq.onerror = () => {
                            db.close();
                            resolve(false);
                        };
                    };
                    req.onerror = () => reject(req.error);
                });
            }
        };
    }

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
