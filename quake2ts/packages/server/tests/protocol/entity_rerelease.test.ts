
import { describe, it, expect } from 'vitest';
import { BinaryWriter, EntityState, BinaryStream } from '@quake2ts/shared';
import { writeDeltaEntity } from '../../src/protocol/entity.js';

describe('Entity Protocol Rerelease', () => {
    it('should write rerelease fields when they are present', () => {
        const writer = new BinaryWriter();
        const from: EntityState = {
            number: 1,
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            modelIndex: 1,
            frame: 0,
            skinNum: 0,
            effects: 0,
            renderfx: 0,
            solid: 0,
            sound: 0,
            event: 0
        };
        const to: EntityState = {
            ...from,
            alpha: 0.5,
            scale: 2.0,
            instanceBits: 0xFF,
            loopVolume: 0.8,
            loopAttenuation: 0.5,
            owner: 2,
            oldFrame: 10,
            modelIndex2: 3,
            modelIndex3: 4,
            modelIndex4: 5
        };

        writeDeltaEntity(from, to, writer, false, false);

        const data = writer.getData();

        expect(data.length).toBeGreaterThan(20);

        // Header check:
        // Byte 0: bits 0-7. U_MOREBITS1 (bit 7) should be set.
        expect(data[0] & 0x80).toBe(0x80);

        // Byte 1: bits 8-15. U_MOREBITS2 (bit 15) should be set.
        expect(data[1] & 0x80).toBe(0x80);

        // Byte 2: bits 16-23. U_MOREBITS3 (bit 23) should be set.
        expect(data[2] & 0x80).toBe(0x80);

        // Byte 3: bits 24-31. U_MOREBITS4 (bit 31) should be set.
        expect(data[3] & 0x80).toBe(0x80);

        // Byte 4: High bits (bitsHigh).
        // We expect U_OWNER_HIGH (bit 1), U_OLD_FRAME_HIGH (bit 2), U_LOOP_ATTENUATION_HIGH (bit 0).
        // So 1 | 2 | 4 = 7.
        expect(data[4]).toBe(7);

        // Byte 5: Number (1)
        expect(data[5]).toBe(1);
    });

    it('should write delta when fields are reset to 0', () => {
        const writer = new BinaryWriter();
        const from: EntityState = {
            number: 1,
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            modelIndex: 1,
            modelIndex2: 3, // Was 3
            frame: 0,
            skinNum: 0,
            effects: 0,
            renderfx: 0,
            solid: 0,
            sound: 0,
            event: 0
        };
        const to: EntityState = {
            ...from,
            modelIndex2: 0 // Reset to 0
        };

        writeDeltaEntity(from, to, writer, false, false);
        const data = writer.getData();

        // U_MODEL2 is 1<<20
        // This is in byte 2 (16-23). 1<<4 = 16.
        // U_MOREBITS1, U_MOREBITS2, U_MOREBITS3 will be set because U_MODEL2 is bit 20.

        // Byte 0: U_MOREBITS1 (0x80)
        expect(data[0] & 0x80).toBe(0x80);

        // Byte 1: U_MOREBITS2 (0x80)
        expect(data[1] & 0x80).toBe(0x80);

        // Byte 2: U_MODEL2 (0x10) | U_MOREBITS3 (0x80) -> 0x90
        // Wait, is U_MOREBITS3 needed?
        // U_MODEL2 is bit 20.
        // If no bits > 23 are set, U_MOREBITS3 (bit 23) might not be needed?
        // Wait, U_MOREBITS3 is bit 23.
        // If any bit >= 24 is set, U_MOREBITS3 is set.
        // In this case, only U_MODEL2 (20) is set.
        // So U_MOREBITS3 is NOT set.
        // Bit 20 corresponds to 0x10 in the 3rd byte (bits 16-23).
        expect(data[2] & 0x10).toBe(0x10);
    });

    it('should trigger U_MOREBITS cascade when only High bits change', () => {
        const writer = new BinaryWriter();
        const from: EntityState = {
            number: 1,
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            modelIndex: 1,
            frame: 0,
            skinNum: 0,
            effects: 0,
            renderfx: 0,
            solid: 0,
            sound: 0,
            event: 0,
            owner: 1
        };
        const to: EntityState = {
            ...from,
            owner: 2 // Only owner changes (High Bit)
        };

        writeDeltaEntity(from, to, writer, false, false);
        const data = writer.getData();

        // Logic:
        // owner changed -> U_OWNER_HIGH (bit 1 of High byte) -> bitsHigh > 0
        // bitsHigh > 0 -> U_MOREBITS4 (bit 31 of bits) is set.
        // U_MOREBITS4 (bit 31) is set -> U_MOREBITS3 (bit 23) must be set.
        // U_MOREBITS3 (bit 23) is set -> U_MOREBITS2 (bit 15) must be set.
        // U_MOREBITS2 (bit 15) is set -> U_MOREBITS1 (bit 7) must be set.

        // Verify cascade:
        expect(data[0] & 0x80).toBe(0x80); // Byte 0 has U_MOREBITS1
        expect(data[1] & 0x80).toBe(0x80); // Byte 1 has U_MOREBITS2
        expect(data[2] & 0x80).toBe(0x80); // Byte 2 has U_MOREBITS3
        expect(data[3] & 0x80).toBe(0x80); // Byte 3 has U_MOREBITS4

        expect(data[4]).toBe(2); // U_OWNER_HIGH (1 << 1) = 2
    });
});
