import { describe, expect, it } from 'vitest';
import { normalizePath, VirtualFileSystem, type Archive } from '../src/index.js';

/** A plain in-memory archive: the smallest thing that implements Archive. */
function archive(name: string, files: Record<string, string>): Archive {
  const data = new Map(Object.entries(files).map(([k, v]) => [normalizePath(k), new TextEncoder().encode(v)]));
  const entries = Object.keys(files).map((k) => ({ name: k, offset: 0, length: files[k].length }));
  return {
    name,
    size: entries.reduce((n, e) => n + e.length, 0),
    listEntries: () => entries,
    readFile: (path) => {
      const bytes = data.get(normalizePath(path));
      if (!bytes) throw new Error(`missing ${path}`);
      return bytes;
    },
  };
}

describe('VirtualFileSystem', () => {
  const base = archive('base', { 'maps/a.bsp': 'base-a', 'maps/b.bsp': 'base-b', 'readme.txt': 'hi' });
  const mod = archive('mod', { 'maps/a.bsp': 'mod-a', 'sound/x.wav': 'x' });

  it('looks paths up ignoring case and slashes', async () => {
    const vfs = new VirtualFileSystem([base]);
    expect(vfs.hasFile('\\MAPS\\B.BSP')).toBe(true);
    expect(await vfs.readTextFile('/maps/b.bsp')).toBe('base-b');
  });

  it('lets the later archive win at equal priority', async () => {
    const vfs = new VirtualFileSystem([base, mod]);
    expect(await vfs.readTextFile('maps/a.bsp')).toBe('mod-a');
    expect(vfs.stat('maps/a.bsp')?.sourcePak).toBe('mod');
  });

  it('lets a higher priority win whatever the order', async () => {
    const vfs = new VirtualFileSystem();
    vfs.mount(base, 10);
    vfs.mount(mod, 0);
    expect(await vfs.readTextFile('maps/a.bsp')).toBe('base-a');
    vfs.setPriority(mod, 20);
    expect(await vfs.readTextFile('maps/a.bsp')).toBe('mod-a');
    expect(vfs.getPaks().map((m) => m.pak.name)).toEqual(['base', 'mod']);
  });

  it('lists a folder, files and subfolders', () => {
    const vfs = new VirtualFileSystem([base, mod]);
    const root = vfs.list();
    expect(root.directories).toEqual(['maps', 'sound']);
    expect(root.files.map((f) => f.path)).toEqual(['readme.txt']);
    expect(vfs.list('maps/').files.map((f) => f.path)).toEqual(['maps/a.bsp', 'maps/b.bsp']);
  });

  it('finds files by extension and builds a tree', () => {
    const vfs = new VirtualFileSystem([base, mod]);
    expect(vfs.findByExtension('BSP').map((f) => f.path)).toEqual(['maps/a.bsp', 'maps/b.bsp']);
    const tree = vfs.getDirectoryTree();
    expect(tree.directories.map((d) => d.name)).toEqual(['maps', 'sound']);
    expect(tree.files.map((f) => f.path)).toEqual(['readme.txt']);
  });

  it('streams a file in chunks', async () => {
    const vfs = new VirtualFileSystem([base]);
    const reader = vfs.streamFile('maps/a.bsp', 4).getReader();
    const chunks: number[] = [];
    for (let r = await reader.read(); !r.done; r = await reader.read()) chunks.push(r.value.length);
    expect(chunks).toEqual([4, 2]);
  });

  it('says which path is missing', async () => {
    const vfs = new VirtualFileSystem([base]);
    await expect(vfs.readFile('nope.txt')).rejects.toThrow('File not found in VFS: nope.txt');
  });
});
