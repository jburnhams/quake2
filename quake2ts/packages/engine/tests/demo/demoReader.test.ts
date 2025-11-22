import { describe, it, expect } from 'vitest';
import { DemoReader } from '../../src/demo/demoReader.js';

describe('DemoReader', () => {
  it('should read a single block correctly', () => {
    const messageLength = 4;
    const bufferLength = 4 + messageLength;
    const buffer = new ArrayBuffer(bufferLength);
    const view = new DataView(buffer);

    // Write length
    view.setInt32(0, messageLength, true);
    // Write "data" (0xAA, 0xBB, 0xCC, 0xDD)
    view.setUint8(4, 0xAA);
    view.setUint8(5, 0xBB);
    view.setUint8(6, 0xCC);
    view.setUint8(7, 0xDD);

    const reader = new DemoReader(buffer);

    expect(reader.hasMore()).toBe(true);
    const block = reader.readNextBlock();

    expect(block).not.toBeNull();
    expect(block!.length).toBe(messageLength);

    // Verify data
    const stream = block!.data;
    expect(stream.readByte()).toBe(0xAA);
    expect(stream.readByte()).toBe(0xBB);
    expect(stream.readByte()).toBe(0xCC);
    expect(stream.readByte()).toBe(0xDD);

    expect(reader.hasMore()).toBe(false);
  });

  it('should handle multiple blocks', () => {
    // Block 1: 2 bytes
    // Block 2: 1 byte
    const buffer = new ArrayBuffer(4 + 2 + 4 + 1);
    const view = new DataView(buffer);
    let offset = 0;

    // Block 1
    view.setInt32(offset, 2, true); offset += 4;
    view.setUint8(offset, 1); offset++;
    view.setUint8(offset, 2); offset++;

    // Block 2
    view.setInt32(offset, 1, true); offset += 4;
    view.setUint8(offset, 3); offset++;

    const reader = new DemoReader(buffer);

    const block1 = reader.readNextBlock();
    expect(block1).not.toBeNull();
    expect(block1!.length).toBe(2);
    expect(block1!.data.readByte()).toBe(1);

    const block2 = reader.readNextBlock();
    expect(block2).not.toBeNull();
    expect(block2!.length).toBe(1);
    expect(block2!.data.readByte()).toBe(3);

    expect(reader.hasMore()).toBe(false);
  });

  it('should handle incomplete blocks gracefully', () => {
    const buffer = new ArrayBuffer(4 + 10); // Length says 20, but only 10 bytes exist
    const view = new DataView(buffer);
    view.setInt32(0, 20, true);

    const reader = new DemoReader(buffer);
    const block = reader.readNextBlock();

    expect(block).toBeNull();
  });

  it('should handle truncated length', () => {
      const buffer = new ArrayBuffer(2); // Not enough for 4-byte length
      const reader = new DemoReader(buffer);
      const block = reader.readNextBlock();
      expect(block).toBeNull();
  });
});
