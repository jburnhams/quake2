import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DemoStorage } from '@quake2ts/client/demo/storage.js';
import 'fake-indexeddb/auto';

describe('DemoStorage', () => {
    let storage: DemoStorage;

    beforeEach(async () => {
        // Reset IndexedDB state
        await new Promise<void>((resolve, reject) => {
            const req = indexedDB.deleteDatabase('quake2ts-demos');
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
            req.onblocked = () => {
                console.warn("DB delete blocked");
                // If blocked, just proceed, we might fail but better than hang
                resolve();
            };
        });

        storage = new DemoStorage();
    });

    afterEach(() => {
        // Ensure connection is closed so next test can delete DB
        storage.close();
    });

    it('should save and load a demo', async () => {
        const name = 'test.dm2';
        const data = new ArrayBuffer(16);

        await storage.saveDemo(name, data, 120);

        const loaded = await storage.loadDemo(name);
        expect(loaded).toBeDefined();
        expect(loaded?.name).toBe(name);
        expect(loaded?.data.byteLength).toBe(16);
        expect(loaded?.duration).toBe(120);
    });

    it('should overwrite existing demo with same name', async () => {
        const name = 'overwrite.dm2';
        await storage.saveDemo(name, new ArrayBuffer(8));

        const loaded1 = await storage.loadDemo(name);
        expect(loaded1?.data.byteLength).toBe(8);

        await storage.saveDemo(name, new ArrayBuffer(32));

        const loaded2 = await storage.loadDemo(name);
        expect(loaded2?.data.byteLength).toBe(32);
    });

    it('should list demos with metadata sorted by date', async () => {
        const demo1 = 'demo1.dm2';
        const demo2 = 'demo2.dm2';

        await storage.saveDemo(demo1, new ArrayBuffer(10));
        // Ensure timestamp difference
        await new Promise(r => setTimeout(r, 10));
        await storage.saveDemo(demo2, new ArrayBuffer(20));

        const list = await storage.listDemos();

        // Filter to only ours in case DB wasn't fully cleared
        const ours = list.filter(d => d.name === demo1 || d.name === demo2);
        expect(ours.length).toBe(2);

        // Should be sorted by date desc (newest first)
        expect(ours[0].name).toBe(demo2);
        expect(ours[1].name).toBe(demo1);

        expect(ours[0].size).toBe(20);
    });

    it('should delete a demo', async () => {
        const name = 'delete_me.dm2';
        await storage.saveDemo(name, new ArrayBuffer(8));

        let loaded = await storage.loadDemo(name);
        expect(loaded).toBeDefined();

        await storage.deleteDemo(name);

        loaded = await storage.loadDemo(name);
        expect(loaded).toBeNull();
    });
});
