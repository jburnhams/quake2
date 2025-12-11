import { describe, it, expect } from 'vitest';
import { BinaryStream, BinaryWriter } from '../src/io';

describe('Serialization', () => {
  describe('BinaryWriter/BinaryStream Complex Types', () => {
    it('handles nested structures', () => {
      // BinaryWriter takes a number (size) or Uint8Array.
      const writer = new BinaryWriter(1024);

      // Simulate a complex structure:
      // struct {
      //   id: uint32
      //   pos: vec3 (3 floats)
      //   name: string
      //   active: uint8 (bool)
      // }

      const id = 12345;
      const pos = { x: 10.5, y: -20.0, z: 30.125 };
      const name = "Player1";
      const active = 1;

      writer.writeLong(id);
      writer.writeFloat(pos.x);
      writer.writeFloat(pos.y);
      writer.writeFloat(pos.z);
      writer.writeString(name);
      writer.writeByte(active);

      // In this codebase, BinaryStream acts as the reader
      const reader = new BinaryStream(writer.getData());

      expect(reader.readLong()).toBe(id);
      expect(reader.readFloat()).toBeCloseTo(pos.x);
      expect(reader.readFloat()).toBeCloseTo(pos.y);
      expect(reader.readFloat()).toBeCloseTo(pos.z);
      expect(reader.readString()).toBe(name);
      expect(reader.readByte()).toBe(active);
    });

    it('handles arrays of data', () => {
      const writer = new BinaryWriter(1024);

      const numbers = [1, 2, 3, 4, 5];
      writer.writeLong(numbers.length);
      for (const n of numbers) {
        writer.writeLong(n);
      }

      const reader = new BinaryStream(writer.getData());
      const count = reader.readLong();
      expect(count).toBe(numbers.length);

      const readNumbers: number[] = [];
      for (let i = 0; i < count; i++) {
        readNumbers.push(reader.readLong());
      }
      expect(readNumbers).toEqual(numbers);
    });
  });

  describe('NetChan Header Serialization', () => {
    it('encodes and decodes NetChan header correctly', () => {
      // NetChan header: sequence (4), ack (4)
      const writer = new BinaryWriter(16);

      const sequence = 0x12345678;
      const ack = 0x87654321;

      writer.writeLong(sequence); // 32-bit int
      writer.writeLong(ack);

      const reader = new BinaryStream(writer.getData());
      expect(reader.readLong()).toBe(sequence);
      expect(reader.readLong()).toBe(ack | 0); // Expect signed comparison
    });
  });
});
