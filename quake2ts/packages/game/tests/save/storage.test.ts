import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { LevelClock } from '../../src/level.js';
import { createSaveFile } from '../../src/save/save.js';
import { SaveStorage } from '../../src/save/storage.js';

function buildSave({
  map = 'base1',
  difficulty = 1,
  playtimeSeconds = 10,
  timestamp = 1000,
}: Partial<Parameters<typeof createSaveFile>[0]> & { timestamp?: number } = {}) {
  const levelClock = new LevelClock();
  levelClock.start(0);
  levelClock.tick({ frame: 5, timeMs: 125, previousTimeMs: 100, deltaSeconds: 0.025 });

  const entities = new EntitySystem(2);
  entities.beginFrame(levelClock.current.timeSeconds);
  entities.spawn();

  return createSaveFile({
    map,
    difficulty,
    playtimeSeconds,
    levelState: levelClock.current,
    entitySystem: entities,
    rngState: { mt: { index: 0, state: new Array(624).fill(0) } },
    timestamp,
  });
}

describe('SaveStorage (memory fallback)', () => {
  it('stores, lists, and reloads saves ordered by timestamp', async () => {
    const storage = new SaveStorage({ indexedDB: null });
    const first = buildSave({ map: 'intro', timestamp: 1000, playtimeSeconds: 5 });
    const second = buildSave({ map: 'boss1', timestamp: 2000, playtimeSeconds: 20, difficulty: 3 });

    const firstMeta = await storage.save('slot1', first, { name: 'First Run' });
    const secondMeta = await storage.save('slot2', second, { name: 'Boss Fight' });

    const listed = await storage.list();
    expect(listed.map((entry) => entry.id)).toEqual(['slot2', 'slot1']);
    expect(listed[0]).toMatchObject({ name: 'Boss Fight', map: 'boss1', difficulty: 3 });
    expect(listed[0].bytes).toBeGreaterThan(0);

    const loadedSecond = await storage.load('slot2');
    expect(loadedSecond).toEqual(second);

    expect(await storage.delete('slot1')).toBe(true);
    expect(await storage.list()).toHaveLength(1);

    const loadedQuick = await storage.load('slot2');
    expect(loadedQuick.playtimeSeconds).toBe(second.playtimeSeconds);

    expect(firstMeta.version).toBe(1);
    expect(secondMeta.version).toBe(1);
  });

  it('overwrites the quicksave slot and rejects missing loads', async () => {
    const storage = new SaveStorage({ indexedDB: null });
    const initial = buildSave({ map: 'mine1', timestamp: 500 });
    const updated = buildSave({ map: 'hangar1', timestamp: 1500 });

    await storage.quickSave(initial);
    await storage.quickSave(updated);

    const quickMeta = await storage.list();
    expect(quickMeta).toHaveLength(1);
    expect(quickMeta[0].map).toBe('hangar1');

    const loaded = await storage.quickLoad();
    expect(loaded.map).toBe('hangar1');

    expect(await storage.delete('quicksave')).toBe(true);
    await expect(storage.quickLoad()).rejects.toThrow('quicksave');
  });
});

describe('SaveStorage (IndexedDB)', () => {
  it('persists saves across instances and honours version validation', async () => {
    const first = new SaveStorage({ indexedDB: fakeIndexedDB, dbName: 'test-saves', storeName: 'saves' });
    const save = buildSave({ map: 'hub', timestamp: 2500, difficulty: 2 });
    await first.save('slot-a', save, { name: 'Checkpoint A' });

    const second = new SaveStorage({ indexedDB: fakeIndexedDB, dbName: 'test-saves', storeName: 'saves' });
    const listed = await second.list();
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('Checkpoint A');

    const loaded = await second.load('slot-a', { allowNewerVersion: false });
    expect(loaded.map).toBe('hub');
    expect(loaded.version).toBe(1);
  });

  it('removes saves from IndexedDB and reports deletion status', async () => {
    const options = { indexedDB: fakeIndexedDB, dbName: 'delete-saves', storeName: 'saves' } as const;
    const storage = new SaveStorage(options);

    await storage.save('slot-a', buildSave({ map: 'base1', timestamp: 100 }));
    await storage.save('slot-b', buildSave({ map: 'base2', timestamp: 200 }));

    expect(await storage.delete('missing')).toBe(false);
    expect(await storage.delete('slot-a')).toBe(true);

    const remaining = await storage.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('slot-b');

    const freshInstance = new SaveStorage(options);
    expect(await freshInstance.list()).toHaveLength(1);
    await expect(freshInstance.load('slot-a')).rejects.toThrow('slot-a');
  });
});
