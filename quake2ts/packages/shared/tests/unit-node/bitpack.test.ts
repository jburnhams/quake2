
import { describe, it, expect } from 'vitest';
import { setCompressedInteger, getCompressedInteger } from '../../src/protocol/bitpack.js';

describe('Bit Packing Helpers', () => {
  describe('setCompressedInteger / getCompressedInteger', () => {
    it('should pack and unpack a single 9-bit value at ID 0', () => {
      const stats = [0, 0, 0, 0];
      const val = 300; // 9-bit value (max 511)

      setCompressedInteger(stats, 0, 0, val, 9);

      const result = getCompressedInteger(stats, 0, 0, 9);
      expect(result).toBe(val);

      // ID 0 (9 bits) occupies bits 0-8.
      // Byte 0: bits 0-7. Byte 1: bit 8.
      // stats[0] should hold this.
      // 300 = 0x12C.
      // In LE: 2C 01.
      // stats[0] should be 0x012C = 300.
      expect(stats[0]).toBe(300);
      expect(stats[1]).toBe(0);
    });

    it('should pack and unpack multiple 9-bit values (Ammo)', () => {
      const stats = [0, 0, 0, 0, 0];
      const startIdx = 0;
      const bits = 9;

      const val0 = 50;  // 000 00110010
      const val1 = 511; // 111 11111111
      const val2 = 0;
      const val3 = 123;

      setCompressedInteger(stats, startIdx, 0, val0, bits);
      setCompressedInteger(stats, startIdx, 1, val1, bits);
      setCompressedInteger(stats, startIdx, 2, val2, bits);
      setCompressedInteger(stats, startIdx, 3, val3, bits);

      expect(getCompressedInteger(stats, startIdx, 0, bits)).toBe(val0);
      expect(getCompressedInteger(stats, startIdx, 1, bits)).toBe(val1);
      expect(getCompressedInteger(stats, startIdx, 2, bits)).toBe(val2);
      expect(getCompressedInteger(stats, startIdx, 3, bits)).toBe(val3);
    });

    it('should correctly handle values straddling array elements', () => {
      const stats = [0, 0];
      const bits = 9;

      // ID 0: bits 0-8 (9 bits) -> stats[0] mostly
      // ID 1: bits 9-17 (9 bits)
      // Bit offset 9 corresponds to Byte offset 1, bit shift 1.
      // Byte offset 1 is the high byte of stats[0].
      // So ID 1 starts inside stats[0] and spills into stats[1].

      setCompressedInteger(stats, 0, 0, 0x1FF, bits); // Fill ID 0 with all 1s
      // stats[0] bits 0-8 are 1.

      setCompressedInteger(stats, 0, 1, 0x1AA, bits);
      // ID 1 value 0x1AA = 1 1010 1010

      expect(getCompressedInteger(stats, 0, 0, bits)).toBe(0x1FF);
      expect(getCompressedInteger(stats, 0, 1, bits)).toBe(0x1AA);
    });

    it('should pack small 2-bit values tightly (Powerups)', () => {
      const stats = [0, 0];
      const bits = 2;

      // Pack 8 values (16 bits) into stats[0]
      for (let i = 0; i < 8; i++) {
        setCompressedInteger(stats, 0, i, i % 4, bits);
      }

      for (let i = 0; i < 8; i++) {
        expect(getCompressedInteger(stats, 0, i, bits)).toBe(i % 4);
      }

      // Ensure stats[1] is still untouched (assuming we filled exactly 16 bits)
      expect(stats[1]).toBe(0);

      // Pack the 9th value -> should go to stats[1] (starts at bit 16)
      setCompressedInteger(stats, 0, 8, 3, bits);
      expect(getCompressedInteger(stats, 0, 8, bits)).toBe(3);
      expect(stats[1]).not.toBe(0);
    });

    it('should handle negative numbers in the array representation correctly (signed 16-bit wrapping)', () => {
      const stats = [0];
      const bits = 16;

      // 0xFFFF = 65535. In signed 16-bit, this is -1.
      setCompressedInteger(stats, 0, 0, 0xFFFF, bits);

      // The array should hold -1
      expect(stats[0]).toBe(-1);

      // Reading it back with getCompressedInteger should return the bits masked
      // getCompressedInteger reads "unsigned" bits.
      // So it should return 65535.
      expect(getCompressedInteger(stats, 0, 0, bits)).toBe(0xFFFF);
    });

    it('should preserve surrounding bits when writing', () => {
      const stats = [0xFFFF]; // All 1s (-1)
      const bits = 4;

      // ID 1: bits 4-7.
      // We want to write 0 into this slot.
      // 0xFFFF = 1111 1111 1111 1111
      // Result should be 1111 1111 0000 1111 = 0xFF0F = -241

      setCompressedInteger(stats, 0, 1, 0, bits);

      expect(getCompressedInteger(stats, 0, 1, bits)).toBe(0);

      // Check neighbors
      expect(getCompressedInteger(stats, 0, 0, bits)).toBe(0xF); // 15
      expect(getCompressedInteger(stats, 0, 2, bits)).toBe(0xF);
      expect(getCompressedInteger(stats, 0, 3, bits)).toBe(0xF);

      expect(stats[0]).toBe(-241);
    });

    it('should work with arbitrary start index', () => {
        const stats = [0, 0, 0, 0, 0];
        const startIdx = 2; // Start packing at stats[2]

        setCompressedInteger(stats, startIdx, 0, 123, 9);

        expect(stats[0]).toBe(0);
        expect(stats[1]).toBe(0);
        expect(stats[2]).not.toBe(0);

        expect(getCompressedInteger(stats, startIdx, 0, 9)).toBe(123);
    });

    it('should clamp/mask values that exceed the bit width', () => {
        const stats = [0];
        const bits = 2;
        const val = 7; // 111 (exceeds 2 bits)

        setCompressedInteger(stats, 0, 0, val, bits);

        // Should only store low 2 bits (11 = 3)
        expect(getCompressedInteger(stats, 0, 0, bits)).toBe(3);
    });
  });
});
