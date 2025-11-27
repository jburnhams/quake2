
import { describe, it, expect } from 'vitest';
import { BinaryWriter, EntityState } from '@quake2ts/shared';
import { writeDeltaEntity } from '../../src/protocol/entity.js';

describe('Entity Protocol', () => {
    it('should write only changed fields', () => {
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
            origin: { x: 10, y: 0, z: 0 } // Changed origin X
        };

        writeDeltaEntity(from, to, writer, false, false);

        const data = writer.getData();
        expect(data.length).toBeGreaterThan(0);

        // Header: U_ORIGIN1 (1) | U_NUMBER (implicit in parsing logic but not flag here).
        // My implementation: bits |= U_ORIGIN1.
        // byte 1: bits (1)
        // byte 2: number (1)
        // byte 3-4: coord(10) -> 80

        expect(data[0]).toBe(1); // U_ORIGIN1
        expect(data[1]).toBe(1); // Number
        expect(data[2]).toBe(80); // 80 & 255
        expect(data[3]).toBe(0);  // 80 >> 8
    });

    it('should write all fields for new entity', () => {
        const writer = new BinaryWriter();
        const from: EntityState = {
            number: 1,
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            modelIndex: 0,
            frame: 0,
            skinNum: 0,
            effects: 0,
            renderfx: 0,
            solid: 0,
            sound: 0,
            event: 0
        };
        const to: EntityState = {
            number: 1,
            origin: { x: 10, y: 20, z: 30 },
            angles: { x: 0, y: 90, z: 0 },
            modelIndex: 1,
            frame: 0,
            skinNum: 0,
            effects: 0,
            renderfx: 0,
            solid: 0,
            sound: 0,
            event: 0
        };

        // newEntity = true, so 'from' is ignored and compared against NULL_STATE
        writeDeltaEntity(from, to, writer, false, true);

        const data = writer.getData();
        expect(data.length).toBeGreaterThan(10);
    });
});
