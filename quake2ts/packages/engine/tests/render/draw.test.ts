
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as draw from '../../src/render/draw';
import { PakArchive } from '../../src/assets/pak.js';

describe('draw', () => {
  beforeEach(() => {
    // Clear document body before each test
    document.body.innerHTML = '';
    // Initialize with real canvas (provided by napi-rs/canvas via vitest.setup.ts)
    draw.Draw_Init(800, 600);
  });

  afterEach(() => {
    // Clean up canvases after each test
    document.body.innerHTML = '';
  });

  it('should initialize a canvas', () => {
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas?.width).toBe(800);
    expect(canvas?.height).toBe(600);
  });

  it('should register a pic', async () => {
    // Create a minimal valid PAK file with one empty entry
    const DIRECTORY_ENTRY_SIZE = 64;
    const headerSize = 12;
    const dirOffset = headerSize;
    const dirLength = DIRECTORY_ENTRY_SIZE; // One entry
    const buffer = new ArrayBuffer(headerSize + dirLength);
    const view = new DataView(buffer);

    // Write "PACK" magic number
    view.setUint8(0, 0x50); // 'P'
    view.setUint8(1, 0x41); // 'A'
    view.setUint8(2, 0x43); // 'C'
    view.setUint8(3, 0x4B); // 'K'

    // Write directory offset
    view.setUint32(4, dirOffset, true);

    // Write directory size
    view.setUint32(8, dirLength, true);

    // Write one directory entry (all zeros except for a dummy name)
    const entryOffset = dirOffset;
    // File name (56 bytes) - write "dummy.txt"
    const name = 'dummy.txt';
    for (let i = 0; i < name.length; i++) {
      view.setUint8(entryOffset + i, name.charCodeAt(i));
    }
    // File offset (4 bytes at position 56)
    view.setUint32(entryOffset + 56, headerSize + dirLength, true);
    // File length (4 bytes at position 60)
    view.setUint32(entryOffset + 60, 0, true);

    const pak = PakArchive.fromArrayBuffer('test.pak', buffer);
    const pic = await draw.Draw_RegisterPic(pak, 'test.png');
    // Should return -1 for non-existent file
    expect(pic).toBe(-1);
  });

  it('should handle drawing a pic safely when pic index is invalid', async () => {
    // Drawing with invalid pic index should not throw
    expect(() => draw.Draw_Pic(10, 20, -1)).not.toThrow();
    expect(() => draw.Draw_Pic(10, 20, 999)).not.toThrow();
  });

  it('should get the pic size for invalid pic', async () => {
    const size = draw.Draw_GetPicSize(-1);
    expect(size).toEqual([0, 0]);
  });

  it('should handle drawing a char without font', () => {
    // Drawing without font should not throw
    expect(() => draw.Draw_Char(10, 20, 65)).not.toThrow();
  });

  it('should handle drawing a string without font', () => {
    // Drawing without font should not throw
    expect(() => draw.Draw_String(10, 20, 'test')).not.toThrow();
  });
});
