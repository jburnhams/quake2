// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { BinaryStream } from '../../../src/io/binaryStream.js';
import { Vec3 } from '../../../src/math/vec3.js';

describe('BinaryStream', () => {
  it('should read bytes correctly', () => {
    const buffer = new Uint8Array([10, 255]);
    const stream = new BinaryStream(buffer);
    expect(stream.readByte()).toBe(10);
    expect(stream.readByte()).toBe(255);
  });

  it('should read chars correctly', () => {
    const buffer = new Int8Array([-10, 127]);
    const stream = new BinaryStream(buffer.buffer);
    expect(stream.readChar()).toBe(-10);
    expect(stream.readChar()).toBe(127);
  });

  it('should read shorts correctly (little endian)', () => {
    const buffer = new Uint8Array([0x01, 0x02]); // 0x0201 = 513
    const stream = new BinaryStream(buffer);
    expect(stream.readShort()).toBe(513);
  });

  it('should read longs correctly (little endian)', () => {
    const buffer = new Uint8Array([0x01, 0x00, 0x00, 0x00]); // 1
    const stream = new BinaryStream(buffer);
    expect(stream.readLong()).toBe(1);
  });

  it('should read floats correctly', () => {
    const buffer = new Float32Array([1.5]);
    const stream = new BinaryStream(buffer.buffer);
    expect(stream.readFloat()).toBe(1.5);
  });

  it('should read strings correctly', () => {
    const text = "Hello\0";
    const buffer = new TextEncoder().encode(text);
    const stream = new BinaryStream(buffer);
    expect(stream.readString()).toBe("Hello");
  });

  it('should read coords correctly (short * 0.125)', () => {
    // 8 * 8 = 64. 64 as short is 0x0040. Little endian: 40 00
    const buffer = new Uint8Array([0x40, 0x00]);
    const stream = new BinaryStream(buffer);
    expect(stream.readCoord()).toBe(8.0);
  });

  it('should read angles correctly (char * 360/256)', () => {
    // 128 corresponds to 180 degrees.
    // MSG_ReadAngle uses MSG_ReadChar (signed).
    // 128 as signed char is -128.
    // -128 * (360/256) = -180.
    const buffer = new Uint8Array([128]);
    const stream = new BinaryStream(buffer);
    expect(stream.readAngle()).toBe(-180.0);
  });
});
