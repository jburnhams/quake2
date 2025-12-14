import { describe, it, expect, vi } from 'vitest';
import { VirtualFileSystem } from '../../src/assets/vfs.js';
import { PakArchive, PakDirectoryEntry } from '../../src/assets/pak.js';

function createMockPak(name: string, files: Record<string, string>): PakArchive {
    return {
        name,
        size: 0,
        listEntries: () => Object.keys(files).map(name => ({ name, length: files[name].length, offset: 0 })),
        readFile: (path: string) => new TextEncoder().encode(files[path]),
        hasFile: (path: string) => path in files,
        getEntry: (path: string) => ({ name: path, length: files[path].length, offset: 0 }) as any,
    } as unknown as PakArchive;
}

describe('VirtualFileSystem Priority', () => {
    it('should respect priority when mounting paks', async () => {
        const pak1 = createMockPak('pak1.pak', {
            'file.txt': 'content from pak1'
        });
        const pak2 = createMockPak('pak2.pak', {
            'file.txt': 'content from pak2'
        });

        const vfs = new VirtualFileSystem();

        // Mount pak1 with lower priority
        vfs.mountPak(pak1, 10);
        // Mount pak2 with higher priority
        vfs.mountPak(pak2, 20);

        const content = await vfs.readTextFile('file.txt');
        expect(content).toBe('content from pak2');

        // Verify source info
        expect(vfs.stat('file.txt')?.sourcePak).toBe('pak2.pak');
    });

    it('should allow lower priority mount to be overridden', async () => {
        const pak1 = createMockPak('pak1.pak', { 'common.txt': 'low' });
        const pak2 = createMockPak('pak2.pak', { 'common.txt': 'high' });

        const vfs = new VirtualFileSystem();

        // Mount high priority first
        vfs.mountPak(pak2, 20);
        // Mount low priority second
        vfs.mountPak(pak1, 10);

        // Should still be 'high' because 20 > 10
        const content = await vfs.readTextFile('common.txt');
        expect(content).toBe('high');
    });

    it('should update priority dynamically', async () => {
        const pak1 = createMockPak('pak1.pak', { 'file.txt': 'pak1' });
        const pak2 = createMockPak('pak2.pak', { 'file.txt': 'pak2' });

        const vfs = new VirtualFileSystem();
        vfs.mountPak(pak1, 10);
        vfs.mountPak(pak2, 20); // pak2 wins

        expect(await vfs.readTextFile('file.txt')).toBe('pak2');

        // Bump pak1 priority above pak2
        vfs.setPriority(pak1, 30);

        expect(await vfs.readTextFile('file.txt')).toBe('pak1');
    });

    it('should list paks with priorities', () => {
        const pak1 = createMockPak('pak1', {});
        const pak2 = createMockPak('pak2', {});
        const vfs = new VirtualFileSystem();
        vfs.mountPak(pak1, 5);
        vfs.mountPak(pak2, 15);

        const paks = vfs.getPaks();
        expect(paks).toHaveLength(2);
        // Should be sorted by priority
        expect(paks[0].pak).toBe(pak1);
        expect(paks[0].priority).toBe(5);
        expect(paks[1].pak).toBe(pak2);
        expect(paks[1].priority).toBe(15);
    });

    it('should override same priority with later mount (LWW)', async () => {
        const pak1 = createMockPak('pak1.pak', { 'file.txt': 'pak1' });
        const pak2 = createMockPak('pak2.pak', { 'file.txt': 'pak2' });

        const vfs = new VirtualFileSystem();
        // Default priority 0
        vfs.mountPak(pak1);
        vfs.mountPak(pak2);

        // Expect pak2 to win because it was mounted last with same priority
        const content = await vfs.readTextFile('file.txt');
        expect(content).toBe('pak2');
    });
});
