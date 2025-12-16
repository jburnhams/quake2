import { describe, it, expect } from 'vitest';
import { PakWriter } from '../../src/assets/pakWriter';
import { PakArchive } from '../../src/assets/pak';

describe('PakWriter', () => {
  it('should create an empty PAK', () => {
    const writer = new PakWriter();
    const buffer = writer.build();
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);

    expect(pak.entries.size).toBe(0);
    expect(pak.size).toBe(12); // Header only
  });

  it('should add a single file', () => {
    const writer = new PakWriter();
    const content = new TextEncoder().encode('hello world');
    writer.addFile('test.txt', content);

    const buffer = writer.build();
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);

    expect(pak.entries.size).toBe(1);
    const entry = pak.getEntry('test.txt');
    expect(entry).toBeDefined();
    expect(entry?.length).toBe(content.byteLength);

    const readContent = pak.readFile('test.txt');
    expect(new TextDecoder().decode(readContent)).toBe('hello world');
  });

  it('should add multiple files', () => {
    const writer = new PakWriter();
    writer.addFile('file1.txt', new Uint8Array([1, 2, 3]));
    writer.addFile('dir/file2.txt', new Uint8Array([4, 5, 6]));

    const buffer = writer.build();
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);

    expect(pak.entries.size).toBe(2);
    expect(pak.getEntry('file1.txt')).toBeDefined();
    expect(pak.getEntry('dir/file2.txt')).toBeDefined();

    expect(pak.readFile('file1.txt')).toEqual(new Uint8Array([1, 2, 3]));
    expect(pak.readFile('dir/file2.txt')).toEqual(new Uint8Array([4, 5, 6]));
  });

  it('should normalize paths', () => {
    const writer = new PakWriter();
    writer.addFile('FOO/BAR.TXT', new Uint8Array([1]));
    writer.addFile('\\baz\\qux.txt', new Uint8Array([2]));

    const buffer = writer.build();
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);

    expect(pak.getEntry('foo/bar.txt')).toBeDefined();
    expect(pak.getEntry('baz/qux.txt')).toBeDefined();
  });

  it('should overwrite existing files', () => {
    const writer = new PakWriter();
    writer.addFile('test.txt', new Uint8Array([1]));
    writer.addFile('test.txt', new Uint8Array([2]));

    const buffer = writer.build();
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);

    expect(pak.entries.size).toBe(1);
    expect(pak.readFile('test.txt')).toEqual(new Uint8Array([2]));
  });

  it('should remove files', () => {
    const writer = new PakWriter();
    writer.addFile('test.txt', new Uint8Array([1]));
    expect(writer.removeFile('test.txt')).toBe(true);
    expect(writer.removeFile('nonexistent.txt')).toBe(false);

    const buffer = writer.build();
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);

    expect(pak.entries.size).toBe(0);
  });

  it('should enforce 56 character limit', () => {
    const writer = new PakWriter();
    const longPath = 'a'.repeat(57);
    expect(() => writer.addFile(longPath, new Uint8Array([]))).toThrow(/Path too long/);

    const okPath = 'a'.repeat(56);
    expect(() => writer.addFile(okPath, new Uint8Array([]))).not.toThrow();
  });

  it('should create PAK from static helper', () => {
    const entries = new Map<string, Uint8Array>();
    entries.set('test.txt', new Uint8Array([1]));

    const buffer = PakWriter.buildFromEntries(entries);
    const pak = PakArchive.fromArrayBuffer('test.pak', buffer.buffer);

    expect(pak.entries.size).toBe(1);
    expect(pak.readFile('test.txt')).toEqual(new Uint8Array([1]));
  });

  it('should verify exact binary match for round trip', () => {
    // Manually construct a simple PAK structure to verify against
    // Header: PACK + dirOffset(16) + dirLength(64)
    // File: [0xAA, 0xBB]
    // DirEntry: "test.bin" + pad + offset(12) + length(2)

    const writer = new PakWriter();
    writer.addFile('test.bin', new Uint8Array([0xAA, 0xBB]));
    const buffer = writer.build();

    const view = new DataView(buffer.buffer);

    // Header
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe('PACK');
    expect(view.getInt32(4, true)).toBe(12 + 2); // dirOffset: Header + FileData
    expect(view.getInt32(8, true)).toBe(64); // dirLength: 1 entry * 64 bytes

    // File Data
    expect(view.getUint8(12)).toBe(0xAA);
    expect(view.getUint8(13)).toBe(0xBB);

    // Directory Entry
    const nameBytes: number[] = [];
    for(let i=0; i<8; i++) nameBytes.push(view.getUint8(14 + i));
    const name = String.fromCharCode(...nameBytes);
    expect(name).toBe('test.bin');

    expect(view.getInt32(14 + 56, true)).toBe(12); // offset
    expect(view.getInt32(14 + 60, true)).toBe(2); // length
  });
});
