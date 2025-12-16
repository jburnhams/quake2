import { describe, it, expect } from 'vitest';
import { PakWriter } from '../../src/assets/pakWriter';
import { PakArchive } from '../../src/assets/pak';

describe('PakWriter', () => {
  it('should create an empty PAK file', () => {
    const writer = new PakWriter();
    const buffer = writer.build();

    // Header only: 12 bytes
    expect(buffer.byteLength).toBe(12);

    // Check magic
    const magic = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]);
    expect(magic).toBe('PACK');

    // Verify readable by PakArchive
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);
    expect(pak.listEntries().length).toBe(0);
  });

  it('should add files and preserve content', () => {
    const writer = new PakWriter();
    const content1 = new TextEncoder().encode('Hello World');
    const content2 = new Uint8Array([1, 2, 3, 4, 5]);

    writer.addFile('readme.txt', content1);
    writer.addFile('data.bin', content2);

    const buffer = writer.build();
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);

    expect(pak.listEntries().length).toBe(2);

    const read1 = pak.readFile('readme.txt');
    expect(new TextDecoder().decode(read1)).toBe('Hello World');

    const read2 = pak.readFile('data.bin');
    expect(Array.from(read2)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should normalize paths', () => {
    const writer = new PakWriter();
    const content = new Uint8Array([1]);

    writer.addFile('FoLdEr\\FiLe.TxT', content);

    const buffer = writer.build();
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);

    const entry = pak.getEntry('folder/file.txt');
    expect(entry).toBeDefined();
    expect(entry?.name).toBe('folder/file.txt');
  });

  it('should reject paths that are too long', () => {
    const writer = new PakWriter();
    const longName = 'a'.repeat(57); // Max is 56

    expect(() => {
      writer.addFile(longName, new Uint8Array([]));
    }).toThrow('Path too long');
  });

  it('should allow paths exactly 56 chars', () => {
    const writer = new PakWriter();
    const maxName = 'a'.repeat(56);

    writer.addFile(maxName, new Uint8Array([]));

    const buffer = writer.build();
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);

    expect(pak.getEntry(maxName)).toBeDefined();
  });

  it('should overwrite duplicates', () => {
    const writer = new PakWriter();
    writer.addFile('file.txt', new Uint8Array([1]));
    writer.addFile('FILE.TXT', new Uint8Array([2])); // Should normalize to same key

    const buffer = writer.build();
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);

    expect(pak.listEntries().length).toBe(1);
    const data = pak.readFile('file.txt');
    expect(data[0]).toBe(2);
  });

  it('should remove files', () => {
    const writer = new PakWriter();
    writer.addFile('file1.txt', new Uint8Array([1]));
    writer.addFile('file2.txt', new Uint8Array([2]));

    expect(writer.removeFile('file1.txt')).toBe(true);
    expect(writer.removeFile('missing.txt')).toBe(false);

    const buffer = writer.build();
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);

    expect(pak.listEntries().length).toBe(1);
    expect(pak.getEntry('file2.txt')).toBeDefined();
    expect(pak.getEntry('file1.txt')).toBeUndefined();
  });

  it('should build using static helper', () => {
    const entries = new Map<string, Uint8Array>();
    entries.set('test.txt', new Uint8Array([1, 2, 3]));

    const buffer = PakWriter.buildFromEntries(entries);
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);

    expect(pak.readFile('test.txt')).toHaveLength(3);
  });

  it('should correctly calculate offsets', () => {
     const writer = new PakWriter();
     // File 1: 10 bytes
     const file1 = new Uint8Array(10);
     file1.fill(1);
     writer.addFile('a.txt', file1);

     // File 2: 20 bytes
     const file2 = new Uint8Array(20);
     file2.fill(2);
     writer.addFile('b.txt', file2);

     const buffer = writer.build();
     const view = new DataView(buffer.buffer);

     // Header: 12 bytes
     // File 1 starts at 12
     // File 2 starts at 22
     // Directory starts at 42 (12 + 10 + 20)

     const dirOffset = view.getInt32(4, true);
     expect(dirOffset).toBe(42);

     const dirLength = view.getInt32(8, true);
     expect(dirLength).toBe(2 * 64); // 2 entries

     // Directory entries are sorted by name 'a.txt' then 'b.txt'

     // First entry (a.txt) at 42
     const offset1 = view.getInt32(42 + 56, true);
     expect(offset1).toBe(12);

     // Second entry (b.txt) at 42 + 64 = 106
     const offset2 = view.getInt32(106 + 56, true);
     expect(offset2).toBe(22);
  });
});
