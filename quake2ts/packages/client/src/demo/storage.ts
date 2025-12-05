
export interface StoredDemoMetadata {
  name: string;
  date: number;
  size: number;
  duration?: number;
}

export interface StoredDemo extends StoredDemoMetadata {
  data: ArrayBuffer;
}

export class DemoStorage {
  private dbName = 'quake2ts-demos';
  private version = 1;
  private storeName = 'demos';
  private dbPromise: Promise<IDBDatabase> | null = null;
  private dbInstance: IDBDatabase | null = null;

  constructor() {}

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not supported'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.dbInstance = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          // Key by name
          db.createObjectStore(this.storeName, { keyPath: 'name' });
        }
      };
    });

    return this.dbPromise;
  }

  // Helper to close connection, useful for tests
  public close(): void {
      if (this.dbInstance) {
          this.dbInstance.close();
          this.dbInstance = null;
          this.dbPromise = null;
      }
  }

  async saveDemo(name: string, data: ArrayBuffer, duration?: number): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const record: StoredDemo = {
        name,
        data,
        date: Date.now(),
        size: data.byteLength,
        duration
      };

      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to save demo: ${request.error?.message}`));
    });
  }

  async loadDemo(name: string): Promise<StoredDemo | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(name);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(new Error(`Failed to load demo: ${request.error?.message}`));
    });
  }

  async listDemos(): Promise<StoredDemoMetadata[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const results: StoredDemo[] = request.result;
        // Map to metadata to avoid loading all buffers into memory if possible,
        // though getAll() loads everything.
        // Optimally we would use a cursor, but getAll is simpler for now.
        const metadata = results.map(demo => ({
            name: demo.name,
            date: demo.date,
            size: demo.size,
            duration: demo.duration
        })).sort((a, b) => b.date - a.date); // Sort by date descending

        resolve(metadata);
      };
      request.onerror = () => reject(new Error(`Failed to list demos: ${request.error?.message}`));
    });
  }

  async deleteDemo(name: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(name);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete demo: ${request.error?.message}`));
    });
  }
}
