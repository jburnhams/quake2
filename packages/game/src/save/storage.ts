import { parseSaveFile, type GameSaveFile, type ParseSaveOptions } from './save.js';

export interface SaveSlotMetadata {
  readonly id: string;
  readonly name: string;
  readonly map: string;
  readonly difficulty: number;
  readonly playtimeSeconds: number;
  readonly timestamp: number;
  readonly version: number;
  readonly bytes: number;
}

interface SaveRecord {
  readonly id: string;
  readonly metadata: SaveSlotMetadata;
  readonly save: GameSaveFile;
}

interface SaveStorageAdapter {
  init(): Promise<void>;
  put(record: SaveRecord): Promise<void>;
  get(id: string): Promise<SaveRecord | null>;
  delete(id: string): Promise<boolean>;
  list(): Promise<SaveRecord[]>;
}

type TextEncoderLike = { encode(input?: string): Uint8Array };
type TextEncoderCtor = new () => TextEncoderLike;
const TEXT_ENCODER_CTOR: TextEncoderCtor | undefined =
  (globalThis as Record<string, unknown>).TextEncoder as TextEncoderCtor | undefined;

function cloneSave(save: GameSaveFile): GameSaveFile {
  return parseSaveFile({ ...save }, { allowNewerVersion: true });
}

function estimateSizeBytes(save: GameSaveFile): number {
  if (TEXT_ENCODER_CTOR) {
    const encoder = new TEXT_ENCODER_CTOR();
    return encoder.encode(JSON.stringify(save)).length;
  }
  return JSON.stringify(save).length;
}

class MemorySaveAdapter implements SaveStorageAdapter {
  private readonly records = new Map<string, SaveRecord>();

  async init(): Promise<void> {
    return Promise.resolve();
  }

  async put(record: SaveRecord): Promise<void> {
    const copy: SaveRecord = {
      id: record.id,
      metadata: { ...record.metadata },
      save: cloneSave(record.save),
    };
    this.records.set(record.id, copy);
  }

  async get(id: string): Promise<SaveRecord | null> {
    const record = this.records.get(id);
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      metadata: { ...record.metadata },
      save: cloneSave(record.save),
    };
  }

  async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }

  async list(): Promise<SaveRecord[]> {
    return Array.from(this.records.values()).map((record) => ({
      id: record.id,
      metadata: { ...record.metadata },
      save: cloneSave(record.save),
    }));
  }
}

type IndexedDbFactory = { open(name: string, version?: number): unknown };

class IndexedDbSaveAdapter implements SaveStorageAdapter {
  private db: unknown = null;

  constructor(
    private readonly indexedDB: IndexedDbFactory,
    private readonly dbName: string,
    private readonly storeName: string,
  ) {}

  async init(): Promise<void> {
    if (this.db) {
      return;
    }

    this.db = await new Promise<unknown>((resolve, reject) => {
      const request = this.indexedDB.open(this.dbName, 1) as any;
      request.onupgradeneeded = () => {
        request.result.createObjectStore(this.storeName, { keyPath: 'id' });
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
      request.onsuccess = () => resolve(request.result);
    });
  }

  private async runTransaction<T>(mode: 'readonly' | 'readwrite', operation: (store: any) => any): Promise<T> {
    await this.init();
    const database = this.db as any;
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(this.storeName, mode);
      const store = transaction.objectStore(this.storeName);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  }

  async put(record: SaveRecord): Promise<void> {
    await this.runTransaction('readwrite', (store) => store.put(record));
  }

  async get(id: string): Promise<SaveRecord | null> {
    const record = await this.runTransaction<SaveRecord | null>('readonly', (store) => store.get(id));
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      metadata: { ...record.metadata },
      save: cloneSave(record.save),
    };
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.get(id);
    if (!existing) {
      return false;
    }
    await this.runTransaction('readwrite', (store) => store.delete(id));
    return true;
  }

  async list(): Promise<SaveRecord[]> {
    const all = await this.runTransaction<SaveRecord[]>('readonly', (store) => store.getAll());
    return all.map((record) => ({
      id: record.id,
      metadata: { ...record.metadata },
      save: cloneSave(record.save),
    }));
  }
}

export interface SaveStorageOptions {
  readonly dbName?: string;
  readonly storeName?: string;
  readonly indexedDB?: IndexedDbFactory | null;
}

export interface SaveWriteOptions {
  readonly name?: string;
}

export class SaveStorage {
  private static readonly DEFAULT_DB_NAME = 'quake2ts-saves';
  private static readonly DEFAULT_STORE = 'saves';
  private static readonly QUICK_SLOT = 'quicksave';

  private readonly adapter: SaveStorageAdapter;

  constructor(options: SaveStorageOptions = {}) {
    const { dbName = SaveStorage.DEFAULT_DB_NAME, storeName = SaveStorage.DEFAULT_STORE } = options;
    const indexedDBFactory =
      options.indexedDB ?? ((globalThis as Record<string, unknown>).indexedDB as IndexedDbFactory | undefined);
    if (indexedDBFactory) {
      this.adapter = new IndexedDbSaveAdapter(indexedDBFactory, dbName, storeName);
    } else {
      this.adapter = new MemorySaveAdapter();
    }
  }

  async save(slotId: string, save: GameSaveFile, options: SaveWriteOptions = {}): Promise<SaveSlotMetadata> {
    const normalized = cloneSave(save);
    const metadata: SaveSlotMetadata = {
      id: slotId,
      name: options.name ?? slotId,
      map: normalized.map,
      difficulty: normalized.difficulty,
      playtimeSeconds: normalized.playtimeSeconds,
      timestamp: normalized.timestamp,
      version: normalized.version,
      bytes: estimateSizeBytes(normalized),
    };

    await this.adapter.init();
    await this.adapter.put({ id: slotId, metadata, save: normalized });
    return metadata;
  }

  async load(slotId: string, options: ParseSaveOptions = {}): Promise<GameSaveFile> {
    await this.adapter.init();
    const record = await this.adapter.get(slotId);
    if (!record) {
      throw new Error(`Save slot ${slotId} not found`);
    }
    return parseSaveFile(record.save, options);
  }

  async delete(slotId: string): Promise<boolean> {
    await this.adapter.init();
    return this.adapter.delete(slotId);
  }

  async list(): Promise<SaveSlotMetadata[]> {
    await this.adapter.init();
    const records = await this.adapter.list();
    return records
      .map((record) => ({ ...record.metadata }))
      .sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id));
  }

  async quickSave(save: GameSaveFile): Promise<SaveSlotMetadata> {
    return this.save(SaveStorage.QUICK_SLOT, save, { name: 'Quick Save' });
  }

  async quickLoad(options: ParseSaveOptions = {}): Promise<GameSaveFile> {
    return this.load(SaveStorage.QUICK_SLOT, options);
  }
}
