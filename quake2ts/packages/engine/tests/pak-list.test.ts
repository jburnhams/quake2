import { describe, it, expect } from 'vitest';
import { PakArchive } from '../src/assets/pak.js';

describe('PakArchive', () => {
  // Simple helper to create a minimal valid PAK buffer
  function createMockPakBuffer(entries: { name: string; content: string }[]) {
    const magic = 'PACK';
    const headerSize = 12;
    const entrySize = 64;

    const dirOffset = headerSize + entries.reduce((acc, e) => acc + e.content.length, 0);
    const dirLength = entries.length * entrySize;
    const totalSize = dirOffset + dirLength;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    // Header
    for (let i = 0; i < 4; i++) view.setUint8(i, magic.charCodeAt(i));
    view.setInt32(4, dirOffset, true);
    view.setInt32(8, dirLength, true);

    // Content and Directory
    let currentOffset = headerSize;
    let dirPtr = dirOffset;

    for (const entry of entries) {
      // Write content
      for (let i = 0; i < entry.content.length; i++) {
        uint8[currentOffset + i] = entry.content.charCodeAt(i);
      }

      // Write directory entry
      // Name (56 bytes)
      for (let i = 0; i < 56; i++) {
        const charCode = i < entry.name.length ? entry.name.charCodeAt(i) : 0;
        view.setUint8(dirPtr + i, charCode);
      }
      // Offset (4 bytes)
      view.setInt32(dirPtr + 56, currentOffset, true);
      // Length (4 bytes)
      view.setInt32(dirPtr + 60, entry.content.length, true);

      currentOffset += entry.content.length;
      dirPtr += entrySize;
    }

    return buffer;
  }

  it('should list file names with list()', () => {
    const buffer = createMockPakBuffer([
      { name: 'file1.txt', content: 'hello' },
      { name: 'dir/file2.txt', content: 'world' }
    ]);

    const pak = PakArchive.fromArrayBuffer('test.pak', buffer);
    const list = pak.list();

    expect(list).toHaveLength(2);
    expect(list).toContain('file1.txt');
    expect(list).toContain('dir/file2.txt');
  });

  it('should list entries with listEntries()', () => {
    const buffer = createMockPakBuffer([
      { name: 'file1.txt', content: 'hello' }
    ]);

    const pak = PakArchive.fromArrayBuffer('test.pak', buffer);
    const entries = pak.listEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('file1.txt');
    expect(entries[0].length).toBe(5);
  });
});
