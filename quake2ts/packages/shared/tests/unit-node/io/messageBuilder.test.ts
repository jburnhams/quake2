import { describe, expect, it } from 'vitest';
import { NetworkMessageBuilder } from '../../../src/io/messageBuilder.js';
import { ANORMS } from '../../../src/math/anorms.js';

describe('io/NetworkMessageBuilder', () => {
  it('writes basic types correctly', () => {
    const builder = new NetworkMessageBuilder();
    builder.writeByte(0x12);
    builder.writeChar(-5);
    builder.writeShort(-12345);
    builder.writeUShort(54321);
    builder.writeLong(1234567890);
    builder.writeFloat(3.14159);

    const data = builder.getData();
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    expect(view.getUint8(offset)).toBe(0x12); offset += 1;
    expect(view.getInt8(offset)).toBe(-5); offset += 1;
    expect(view.getInt16(offset, true)).toBe(-12345); offset += 2;
    expect(view.getUint16(offset, true)).toBe(54321); offset += 2;
    expect(view.getInt32(offset, true)).toBe(1234567890); offset += 4;
    expect(view.getFloat32(offset, true)).toBeCloseTo(3.14159); offset += 4;
  });

  it('writes strings with null terminator', () => {
    const builder = new NetworkMessageBuilder();
    const str = "Hello Quake";
    builder.writeString(str);

    const data = builder.getData();
    expect(data.length).toBe(str.length + 1);

    for (let i = 0; i < str.length; i++) {
      expect(data[i]).toBe(str.charCodeAt(i));
    }
    expect(data[str.length]).toBe(0);
  });

  it('writes coordinates (fixed point 1/8)', () => {
    const builder = new NetworkMessageBuilder();
    const val = 12.5;
    builder.writeCoord(val);

    const data = builder.getData();
    const view = new DataView(data.buffer);
    // 12.5 * 8 = 100
    expect(view.getInt16(0, true)).toBe(100);
  });

  it('writes angles (byte)', () => {
    const builder = new NetworkMessageBuilder();
    builder.writeAngle(90);  // 90/360 * 256 = 64
    builder.writeAngle(180); // 180/360 * 256 = 128

    const data = builder.getData();
    expect(data[0]).toBe(64);
    expect(data[1]).toBe(128);
  });

  it('writes angles (short)', () => {
    const builder = new NetworkMessageBuilder();
    builder.writeAngle16(90); // 90/360 * 65536 = 16384

    const data = builder.getData();
    const view = new DataView(data.buffer);
    expect(view.getInt16(0, true)).toBe(16384);
  });

  it('expands buffer automatically', () => {
    const builder = new NetworkMessageBuilder(10);
    const data = new Uint8Array(20).fill(0xFF);
    builder.writeData(data);

    const result = builder.getData();
    expect(result.length).toBe(20);
    expect(result).toEqual(data);
  });

  it('writes best matching normal index for vector', () => {
    const builder = new NetworkMessageBuilder();
    // ANORMS[0] is typically a cardinal axis like (1,0,0) or (0,0,1) depending on definition
    // Let's test with a vector that should map to a known index.
    // Index 2 is usually (0, 1, 0) in Quake norms.
    // Index 4 is (0, 0, 1)

    // Let's just pick one from the ANORMS table to be sure
    const testIndex = 10;
    const target = ANORMS[testIndex];
    builder.writeDir(target[0], target[1], target[2]);

    const data = builder.getData();
    expect(data[0]).toBe(testIndex);
  });
});
