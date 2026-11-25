import { describe, expect, it } from 'vitest';
import { BinaryReader, BinaryWriter } from '../src/index.js';

describe('BinaryWriter and BinaryReader', () => {
  it('round-trips every numeric type little-endian', () => {
    const w = new BinaryWriter(4);
    w.writeByte(250);
    w.writeChar(-5);
    w.writeShort(-1234);
    w.writeUShort(65000);
    w.writeLong(-123456789);
    w.writeFloat(1.5);
    w.writeString('pak0');
    const bytes = w.getData();
    expect(bytes.byteLength).toBe(1 + 1 + 2 + 2 + 4 + 4 + 5);
    expect(bytes[2]).toBe(0x2e); // low byte of -1234 first

    const r = new BinaryReader(bytes);
    expect(r.readByte()).toBe(250);
    expect(r.readChar()).toBe(-5);
    expect(r.readShort()).toBe(-1234);
    expect(r.readUShort()).toBe(65000);
    expect(r.readLong()).toBe(-123456789);
    expect(r.readFloat()).toBe(1.5);
    expect(r.readString()).toBe('pak0');
    expect(r.hasMore()).toBe(false);
  });

  it('reads from a Uint8Array view at a non-zero offset', () => {
    const backing = new Uint8Array([9, 9, 1, 0, 0, 0]);
    const r = new BinaryReader(backing.subarray(2));
    expect(r.readLong()).toBe(1);
  });

  it('stops a string at NUL, 0xFF or the end of the buffer', () => {
    expect(new BinaryReader(new Uint8Array([65, 0, 66])).readString()).toBe('A');
    expect(new BinaryReader(new Uint8Array([65, 0xff, 66])).readString()).toBe('A');
    expect(new BinaryReader(new Uint8Array([65, 66])).readString()).toBe('AB');
    expect(new BinaryReader(new Uint8Array([65, 10, 66])).readStringLine()).toBe('A');
  });

  it('copies readData so later writes to the source do not leak', () => {
    const src = new Uint8Array([1, 2, 3]);
    const out = new BinaryReader(src).readData(2);
    src[0] = 99;
    expect([...out]).toEqual([1, 2]);
  });

  it('refuses to seek or read past the end', () => {
    const r = new BinaryReader(new Uint8Array(2));
    expect(() => r.seek(3)).toThrow(/out of bounds/);
    expect(() => r.readData(3)).toThrow(/out of bounds/);
    expect(() => r.readLong()).toThrow(RangeError);
  });

  it('throws on overflow when writing into a fixed buffer', () => {
    const w = new BinaryWriter(new Uint8Array(1));
    w.writeByte(1);
    expect(() => w.writeByte(2)).toThrow(/overflow/);
  });
});
