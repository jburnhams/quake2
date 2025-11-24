import { describe, it, expect } from 'vitest';
import { BinaryWriter } from '../../src/io/binaryWriter.js';
import { BinaryStream } from '../../src/io/binaryStream.js';

describe('BinaryWriter', () => {
  it('should write and read back primitives', () => {
    const writer = new BinaryWriter();

    writer.writeByte(10);
    writer.writeShort(1000);
    writer.writeLong(100000);
    writer.writeFloat(123.456);
    writer.writeString("Hello Quake");
    writer.writeCoord(10.5);
    writer.writeAngle(90);

    const data = writer.getData();
    const reader = new BinaryStream(data);

    expect(reader.readByte()).toBe(10);
    expect(reader.readShort()).toBe(1000);
    expect(reader.readLong()).toBe(100000);
    expect(reader.readFloat()).toBeCloseTo(123.456);
    expect(reader.readString()).toBe("Hello Quake");
    expect(reader.readCoord()).toBe(10.5);
    // Angle precision: 360 -> 256 -> 360.
    // 90 -> 64 -> 90. Perfect match for 90.
    expect(reader.readAngle()).toBe(90);
  });

  it('should resize buffer automatically', () => {
    const writer = new BinaryWriter(4); // Small initial size
    writer.writeLong(1);
    writer.writeLong(2); // Should trigger resize
    expect(writer.getLength()).toBe(8);

    const reader = new BinaryStream(writer.getData());
    expect(reader.readLong()).toBe(1);
    expect(reader.readLong()).toBe(2);
  });

  it('should write dir', () => {
    const writer = new BinaryWriter();
    // Use a known normal from ANORMS
    // Index 5 is [0, 0, 1]
    writer.writeDir({ x: 0, y: 0, z: 1 });

    const reader = new BinaryStream(writer.getData());
    const dir = { x: 0, y: 0, z: 0 };
    reader.readDir(dir);

    expect(dir.x).toBe(0);
    expect(dir.y).toBe(0);
    expect(dir.z).toBe(1);
  });
});
