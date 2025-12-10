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

  // NEW TESTS

  it('getFileMetadata returns correct metadata with offset', () => {
    const pak = makePak('base.pak', [{ path: 'test.txt', data: 'hello' }]);
    const vfs = new VirtualFileSystem([pak]);
    const meta = vfs.getFileMetadata('test.txt');

    expect(meta).toBeDefined();
    expect(meta?.path).toBe('test.txt');
    expect(meta?.size).toBe(5);
    expect(meta?.sourcePak).toBe('base.pak');
    expect(meta?.offset).toBeGreaterThan(0);
  });

  it('listByExtension supports multiple extensions', () => {
    const pak = makePak('base.pak', [
      { path: 'a.txt', data: '' },
      { path: 'b.cfg', data: '' },
      { path: 'c.dat', data: '' },
    ]);
    const vfs = new VirtualFileSystem([pak]);
    const results = vfs.listByExtension(['.txt', 'cfg']); // mixed format

    expect(results.map(f => f.path)).toEqual(expect.arrayContaining(['a.txt', 'b.cfg']));
    expect(results.length).toBe(2);
  });

  it('searchFiles finds files by regex', () => {
    const pak = makePak('base.pak', [
      { path: 'maps/base1.bsp', data: '' },
      { path: 'maps/base2.bsp', data: '' },
      { path: 'textures/wall.wal', data: '' },
    ]);
    const vfs = new VirtualFileSystem([pak]);
    const results = vfs.searchFiles(/base\d/);

    expect(results.map(f => f.path)).toEqual(expect.arrayContaining(['maps/base1.bsp', 'maps/base2.bsp']));
    expect(results.length).toBe(2);
  });

  it('getPakInfo returns mounted pak metadata', () => {
    const pak1 = makePak('pak0.pak', [{ path: 'a', data: '' }]);
    const pak2 = makePak('pak1.pak', [{ path: 'b', data: '' }, { path: 'c', data: '' }]);
    const vfs = new VirtualFileSystem([pak1, pak2]);

    const info = vfs.getPakInfo();
    expect(info).toHaveLength(2);
    expect(info[0].filename).toBe('pak0.pak');
    expect(info[0].entryCount).toBe(1);
    expect(info[1].filename).toBe('pak1.pak');
    expect(info[1].entryCount).toBe(2);
  });

  it('getDirectoryTree returns hierarchical structure', () => {
    const pak = makePak('base.pak', [
      { path: 'root.txt', data: '' },
      { path: 'env/sky/up.pcx', data: '' },
      { path: 'env/sky/down.pcx', data: '' },
      { path: 'maps/start.bsp', data: '' },
    ]);
    const vfs = new VirtualFileSystem([pak]);
    const tree = vfs.getDirectoryTree();

    expect(tree.files.map(f => f.path)).toEqual(['root.txt']);
    expect(tree.directories.map(d => d.name)).toEqual(['env', 'maps']);

    const envDir = tree.directories.find(d => d.name === 'env');
    expect(envDir).toBeDefined();
    expect(envDir?.directories[0].name).toBe('sky');

    const skyDir = envDir?.directories[0];
    expect(skyDir?.files.map(f => f.path)).toEqual(['env/sky/down.pcx', 'env/sky/up.pcx']);
  });

  it('readTextFile reads file as UTF-8 string', async () => {
    const pak = makePak('base.pak', [{ path: 'readme.txt', data: 'Hello World' }]);
    const vfs = new VirtualFileSystem([pak]);
    const content = await vfs.readTextFile('readme.txt');
    expect(content).toBe('Hello World');
  });

  it('readBinaryFile reads file as Uint8Array', async () => {
    const pak = makePak('base.pak', [{ path: 'data.bin', data: 'BIN' }]);
    const vfs = new VirtualFileSystem([pak]);
    const content = await vfs.readBinaryFile('data.bin');
    expect(content).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(content)).toBe('BIN');
  });

  it('streams file content in chunks', async () => {
    const dataStr = '0123456789'.repeat(10); // 100 bytes
    const pak = makePak('base.pak', [{ path: 'stream.txt', data: dataStr }]);
    const vfs = new VirtualFileSystem([pak]);

    const stream = vfs.streamFile('stream.txt', 10); // 10 bytes per chunk
    const reader = stream.getReader();

    let result = '';
    let chunks = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += new TextDecoder().decode(value);
      chunks++;
      expect(value?.length).toBeLessThanOrEqual(10);
    }

    expect(result).toBe(dataStr);
    expect(chunks).toBe(10);
  });
});
