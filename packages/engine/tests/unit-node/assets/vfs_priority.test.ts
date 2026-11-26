import { describe, it, expect } from 'vitest';
import { VirtualFileSystem } from '../../../src/assets/vfs.js';
import { createTestPakArchive, textData } from '@quake2ts/test-utils';

describe('VirtualFileSystem Priority', () => {
  it('respects priority when mounting paks', async () => {
    const pak1 = createTestPakArchive([{ path: 'config.cfg', data: textData('base config') }], 'pak0.pak');
    const pak2 = createTestPakArchive([{ path: 'config.cfg', data: textData('mod config') }], 'pak1.pak');

    const vfs = new VirtualFileSystem();

    // Mount base pak with lower priority
    vfs.mountPak(pak1, 0);
    // Mount mod pak with higher priority
    vfs.mountPak(pak2, 1);

    const content = await vfs.readTextFile('config.cfg');
    expect(content).toBe('mod config');

    const meta = vfs.getFileMetadata('config.cfg');
    expect(meta?.sourcePak).toBe('pak1.pak');
  });

  it('respects priority regardless of mount order', async () => {
    const pak1 = createTestPakArchive([{ path: 'config.cfg', data: textData('base config') }], 'pak0.pak');
    const pak2 = createTestPakArchive([{ path: 'config.cfg', data: textData('mod config') }], 'pak1.pak');

    const vfs = new VirtualFileSystem();

    // Mount mod pak first with higher priority
    vfs.mountPak(pak2, 1);
    // Mount base pak second with lower priority
    vfs.mountPak(pak1, 0);

    const content = await vfs.readTextFile('config.cfg');
    expect(content).toBe('mod config');
  });

  it('falls back to lower priority if file missing in high priority', async () => {
    const pak1 = createTestPakArchive([{ path: 'base.txt', data: textData('base') }], 'base.pak');
    const pak2 = createTestPakArchive([{ path: 'mod.txt', data: textData('mod') }], 'mod.pak');

    const vfs = new VirtualFileSystem();
    vfs.mountPak(pak1, 0);
    vfs.mountPak(pak2, 1);

    expect(await vfs.readTextFile('base.txt')).toBe('base');
    expect(await vfs.readTextFile('mod.txt')).toBe('mod');
  });

  it('updates priority dynamically', async () => {
    const pak1 = createTestPakArchive([{ path: 'file.txt', data: textData('v1') }], 'pak0.pak');
    const pak2 = createTestPakArchive([{ path: 'file.txt', data: textData('v2') }], 'pak1.pak');

    const vfs = new VirtualFileSystem();
    vfs.mountPak(pak1, 10);
    vfs.mountPak(pak2, 5);

    // Initially pak1 wins (priority 10 > 5)
    expect(await vfs.readTextFile('file.txt')).toBe('v1');

    // Raise pak2 priority
    vfs.setPriority(pak2, 20);

    // Now pak2 wins (priority 20 > 10)
    expect(await vfs.readTextFile('file.txt')).toBe('v2');
  });

  it('getPaks returns sorted list', () => {
    const pak1 = createTestPakArchive([], 'p1');
    const pak2 = createTestPakArchive([], 'p2');
    const pak3 = createTestPakArchive([], 'p3');

    const vfs = new VirtualFileSystem();
    vfs.mountPak(pak1, 5);
    vfs.mountPak(pak2, 10);
    vfs.mountPak(pak3, 1);

    const paks = vfs.getPaks();
    expect(paks).toHaveLength(3);
    // Expect ascending priority
    expect(paks[0].priority).toBe(1);
    expect(paks[0].pak.name).toBe('p3');
    expect(paks[1].priority).toBe(5);
    expect(paks[1].pak.name).toBe('p1');
    expect(paks[2].priority).toBe(10);
    expect(paks[2].pak.name).toBe('p2');
  });
});
