import { describe, expect, it } from 'vitest';
import { VirtualFileSystem } from '../src/assets/vfs.js';
import { PakArchive } from '../src/assets/pak.js';
import { buildPak, textData } from './helpers/pakBuilder.js';

describe('VirtualFileSystem', () => {
  function makePak(name: string, entries: { path: string; data: string }[]): PakArchive {
    return PakArchive.fromArrayBuffer(
      name,
      buildPak(entries.map((entry) => ({ path: entry.path, data: textData(entry.data) }))),
    );
  }

  it('mounts paks and resolves files case-insensitively', async () => {
    const vfs = new VirtualFileSystem();
    vfs.mountPak(makePak('base.pak', [{ path: 'maps/base1.bsp', data: 'world' }]));

    expect(vfs.hasFile('MAPS/BASE1.BSP')).toBe(true);
    await expect(vfs.readFile('maps/base1.bsp').then((data) => new TextDecoder().decode(data))).resolves.toBe('world');
    expect(vfs.stat('maps/base1.bsp')?.sourcePak).toBe('base.pak');
  });

  it('applies override order with later mounts winning', async () => {
    const base = makePak('base.pak', [{ path: 'textures/wall.wal', data: 'base' }]);
    const mod = makePak('mod.pak', [{ path: 'textures/wall.wal', data: 'modded' }]);
    const vfs = new VirtualFileSystem([base, mod]);

    await expect(vfs.readFile('textures/wall.wal').then((data) => new TextDecoder().decode(data))).resolves.toBe('modded');
    expect(vfs.stat('textures/wall.wal')?.sourcePak).toBe('mod.pak');
  });

  it('lists directories and files', () => {
    const pak = makePak('base.pak', [
      { path: 'maps/base1.bsp', data: 'world' },
      { path: 'maps/base2.bsp', data: 'world2' },
      { path: 'textures/wall.wal', data: 'wal' },
    ]);
    const vfs = new VirtualFileSystem([pak]);
    const listing = vfs.list('maps');

    expect(listing.directories).toEqual([]);
    expect(listing.files.map((f) => f.path)).toEqual(['maps/base1.bsp', 'maps/base2.bsp']);
  });

  it('finds files by extension', () => {
    const pak = makePak('base.pak', [
      { path: 'sound/explosion.wav', data: 'boom' },
      { path: 'maps/test.bsp', data: 'world' },
      { path: 'textures/wall.WAL', data: 'wal' },
    ]);
    const vfs = new VirtualFileSystem([pak]);

    expect(vfs.findByExtension('.bsp').map((f) => f.path)).toEqual(['maps/test.bsp']);
    expect(vfs.findByExtension('wal').map((f) => f.path)).toEqual(['textures/wall.wal']);
  });
});
