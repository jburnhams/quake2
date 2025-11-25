import { describe, it, expect } from 'vitest';
import { BinaryWriter } from '../../src/io/binaryWriter.js';
import { BinaryStream } from '../../src/io/binaryStream.js';
import { Vec3 } from '../../src/math/vec3.js';
import { ANORMS } from '../../src/math/anorms.js';

describe('BinaryWriter & BinaryStream Roundtrip', () => {
  it('should write and read bytes', () => {
    const writer = new BinaryWriter();
    writer.writeByte(255);
    writer.writeByte(128);
    writer.writeByte(0);

    const reader = new BinaryStream(writer.getData());
    expect(reader.readByte()).toBe(255);
    expect(reader.readByte()).toBe(128);
    expect(reader.readByte()).toBe(0);
  });

  it('should write and read signed chars', () => {
      const writer = new BinaryWriter();
      writer.writeChar(127);
      writer.writeChar(-128);
      writer.writeChar(-1);

      const reader = new BinaryStream(writer.getData());
      expect(reader.readChar()).toBe(127);
      expect(reader.readChar()).toBe(-128);
      expect(reader.readChar()).toBe(-1);
  });

  it('should write and read shorts', () => {
      const writer = new BinaryWriter();
      writer.writeShort(32767);
      writer.writeShort(-32768);
      writer.writeShort(-1);

      const reader = new BinaryStream(writer.getData());
      expect(reader.readShort()).toBe(32767);
      expect(reader.readShort()).toBe(-32768);
      expect(reader.readShort()).toBe(-1);
  });

  it('should write and read longs', () => {
      const writer = new BinaryWriter();
      writer.writeLong(2147483647);
      writer.writeLong(-2147483648);

      const reader = new BinaryStream(writer.getData());
      expect(reader.readLong()).toBe(2147483647);
      expect(reader.readLong()).toBe(-2147483648);
  });

  it('should write and read floats', () => {
      const writer = new BinaryWriter();
      writer.writeFloat(1.5);
      writer.writeFloat(-1.5);

      const reader = new BinaryStream(writer.getData());
      expect(reader.readFloat()).toBeCloseTo(1.5);
      expect(reader.readFloat()).toBeCloseTo(-1.5);
  });

  it('should write and read strings', () => {
      const writer = new BinaryWriter();
      writer.writeString("Hello World");
      writer.writeString("");

      const reader = new BinaryStream(writer.getData());
      expect(reader.readString()).toBe("Hello World");
      expect(reader.readString()).toBe("");
  });

  it('should write and read coords', () => {
      const writer = new BinaryWriter();
      // coords are fixed point (short / 8)
      writer.writeCoord(10.5); // 10.5 * 8 = 84 (exact)
      writer.writeCoord(-5.125); // -5.125 * 8 = -41 (exact)
      writer.writeCoord(100.1); // 100.1 * 8 = 800.8 -> 800 -> 100.0 (truncation)

      const reader = new BinaryStream(writer.getData());
      expect(reader.readCoord()).toBe(10.5);
      expect(reader.readCoord()).toBe(-5.125);
      expect(reader.readCoord()).toBeCloseTo(100.0); // lossy and truncated
  });

  it('should write and read angles', () => {
      const writer = new BinaryWriter();
      // angle -> byte: angle * 256 / 360
      writer.writeAngle(0);
      writer.writeAngle(180);
      writer.writeAngle(360);
      writer.writeAngle(-180);

      const reader = new BinaryStream(writer.getData());
      expect(reader.readAngle()).toBeCloseTo(0);

      // 180 * 256 / 360 = 128. readChar(-128) * 360/256 = -180.
      expect(Math.abs(reader.readAngle())).toBeCloseTo(180);

      // 360 -> 0
      expect(reader.readAngle()).toBeCloseTo(0);

      // -180 -> -128 -> -180
      expect(reader.readAngle()).toBeCloseTo(-180);
  });

  it('should write and read angles16', () => {
      const writer = new BinaryWriter();
      writer.writeAngle16(0);
      writer.writeAngle16(180);

      const reader = new BinaryStream(writer.getData());
      expect(reader.readAngle16()).toBeCloseTo(0);

      // 180 * 65536 / 360 = 32768. readShort(-32768) * 360/65536 = -180.
      const a = reader.readAngle16();
      // It might be 180 or -180 depending on representation.
      // -180 is congruent to 180 mod 360.
      expect(Math.abs(a)).toBeCloseTo(180);
  });

  it('should write and read dirs', () => {
      const writer = new BinaryWriter();
      const up: Vec3 = { x: 0, y: 0, z: 1 };
      writer.writeDir(up);

      const reader = new BinaryStream(writer.getData());
      const out: Vec3 = { x: 0, y: 0, z: 0 };
      reader.readDir(out);

      expect(out.x).toBeCloseTo(0);
      expect(out.y).toBeCloseTo(0);
      expect(out.z).toBeCloseTo(1);
  });

  it('should handle buffer expansion', () => {
     const writer = new BinaryWriter(10); // small buffer
     for (let i=0; i<100; i++) {
         writer.writeByte(i);
     }
     const reader = new BinaryStream(writer.getData());
     for (let i=0; i<100; i++) {
         expect(reader.readByte()).toBe(i);
     }
  });
});
