import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PakArchive, calculatePakChecksum } from '@quake2ts/engine/assets/pak.js';
import { PakIndexStore } from '@quake2ts/engine/assets/pakIndexStore.js';
import { buildPak, textData } from '@quake2ts/test-utils'; // pakBuilder.js';

describe('PakIndexStore', () => {
  let store: PakIndexStore;

  beforeEach(async () => {
    store = new PakIndexStore('pak-index-test');
    await store.clear();
  });

  it('persists pak validation entries and finds them by checksum', async () => {
    const pakBuffer = buildPak([{ path: 'maps/base1.bsp', data: textData('world') }]);
    const archive = PakArchive.fromArrayBuffer('pak0.pak', pakBuffer);
    const checksum = calculatePakChecksum(pakBuffer);

    const persisted = await store.persist(archive);
    expect(persisted?.checksum).toBe(checksum);
    expect(persisted?.entries).toHaveLength(1);

    const retrieved = await store.find('PAK0.PAK', checksum);
    expect(retrieved?.name).toBe('pak0.pak');
    expect(retrieved?.entries[0]?.name).toBe('maps/base1.bsp');
  });

  it('lists stored indexes ordered by newest first and removes by name', async () => {
    const pakA = PakArchive.fromArrayBuffer('pak0.pak', buildPak([{ path: 'textures/a.wal', data: textData('a') }]));
    const pakB = PakArchive.fromArrayBuffer('pak1.pak', buildPak([{ path: 'textures/b.wal', data: textData('b') }]));
    const pakAReloaded = PakArchive.fromArrayBuffer('pak0.pak', buildPak([{ path: 'textures/a2.wal', data: textData('a2') }]));

    await store.persist(pakA);
    await new Promise((resolve) => setTimeout(resolve, 2));
    await store.persist(pakB);
    await store.persist(pakAReloaded);

    const list = await store.list();
    expect(list.map((entry) => entry.name)).toEqual(['pak0.pak', 'pak1.pak', 'pak0.pak']);

    const removed = await store.remove('pak0.pak');
    expect(removed).toBe(true);
    const after = await store.find('pak0.pak');
    expect(after).toBeUndefined();
  });

  it('gracefully no-ops when IndexedDB is unavailable', async () => {
    const original = globalThis.indexedDB;
    // @ts-expect-error - simulate environment without IndexedDB
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;

    const archive = PakArchive.fromArrayBuffer('pak2.pak', buildPak([{ path: 'maps/test.bsp', data: textData('x') }]));
    const unavailable = new PakIndexStore('no-indexdb');
    const persistResult = await unavailable.persist(archive);
    const lookup = await unavailable.find('pak2.pak');

    expect(persistResult).toBeUndefined();
    expect(lookup).toBeUndefined();

    vi.restoreAllMocks();
    globalThis.indexedDB = original;
  });
});
