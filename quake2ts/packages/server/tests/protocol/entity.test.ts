import { describe, it, expect } from 'vitest';
import { writeDeltaEntity } from '../../src/protocol/entity.js';
import { BinaryWriter, EntityState, BinaryStream, U_MODEL, U_ORIGIN1, U_ANGLE2, U_FRAME, U_MOREBITS, U_ORIGIN2, U_ORIGIN3, U_ANGLE1, U_ANGLE3, U_SKIN, U_EFFECTS, U_RENDERFX, U_SOLID, U_EVENT } from '@quake2ts/shared';

const NULL_STATE: EntityState = {
    number: 0,
    origin: { x: 0, y: 0, z: 0 },
    angles: { x: 0, y: 0, z: 0 },
    modelIndex: 0,
    frame: 0,
    skinNum: 0,
    effects: 0,
    renderfx: 0,
    solid: 0,
    sound: 0,
    event: 0,
};

const createMockState = (overrides: Partial<EntityState> = {}): EntityState => {
    return {
        number: 1,
        origin: { x: 10, y: 20, z: 30 },
        angles: { x: 0, y: 90, z: 180 },
        modelIndex: 1,
        frame: 5,
        skinNum: 2,
        effects: 3,
        renderfx: 4,
        solid: 5,
        sound: 6,
        event: 0, // Events are transient
        ...overrides,
    };
};

describe('writeDeltaEntity', () => {
    it('should write nothing if states are identical', () => {
        const state = createMockState();
        const writer = new BinaryWriter();
        writeDeltaEntity(state, state, writer, false, false);
        expect(writer.getData().byteLength).toBe(1); // will write 0 for the bits
    });

    it('should write all fields for a new entity', () => {
        const toState = createMockState();
        const writer = new BinaryWriter();
        writeDeltaEntity(NULL_STATE, toState, writer, false, true);

        const stream = new BinaryStream(writer.getData().buffer);
        const bits = stream.readByte();
        // Check a few key flags
        expect(bits & EntityFlags.U_MODEL).toBe(EntityFlags.U_MODEL);
        expect(bits & EntityFlags.U_ORIGIN1).toBe(EntityFlags.U_ORIGIN1);
        expect(bits & EntityFlags.U_ANGLE2).toBe(EntityFlags.U_ANGLE2);
    });

    it('should write only changed fields (single byte mask)', () => {
        const fromState = createMockState();
        const toState = createMockState({
            origin: { x: 11, y: 20, z: 30 }, // origin.x changed
            frame: 6,                      // frame changed
        });

        const writer = new BinaryWriter();
        writeDeltaEntity(fromState, toState, writer, false, false);

        const stream = new BinaryStream(writer.getData().buffer);
        const bits = stream.readByte();
        expect(bits).toBe(EntityFlags.U_ORIGIN1 | EntityFlags.U_FRAME);

        expect(stream.readCoord()).toBe(11);
        expect(stream.readByte()).toBe(6);
        expect(stream.hasMore()).toBe(false);
    });

    it('should use a two-byte bitmask when necessary', () => {
        const fromState = createMockState();
        const toState = createMockState({
            modelIndex: 2,
            origin: { x: 11, y: 21, z: 31 },
            angles: { x: 1, y: 91, z: 181 },
            frame: 6,
            skinNum: 3,
            effects: 4,
            renderfx: 5,
            solid: 6,
        });

        const writer = new BinaryWriter();
        writeDeltaEntity(fromState, toState, writer, false, false);

        const stream = new BinaryStream(writer.getData().buffer);
        const bits1 = stream.readByte();
        const bits2 = stream.readByte();
        const bits = bits1 | (bits2 << 8);

        expect(bits & EntityFlags.U_MOREBITS).toBe(EntityFlags.U_MOREBITS);
        const expectedBits = EntityFlags.U_MODEL | EntityFlags.U_ORIGIN1 | EntityFlags.U_ORIGIN2 | EntityFlags.U_ORIGIN3 |
                             EntityFlags.U_ANGLE1 | EntityFlags.U_ANGLE2 | EntityFlags.U_ANGLE3 | EntityFlags.U_FRAME |
                             EntityFlags.U_SKIN | Entity_Flags.U_EFFECTS | EntityFlags.U_RENDERFX | EntityFlags.U_SOLID | EntityFlags.U_MOREBITS;
        expect(bits).toBe(expectedBits);
    });

    it('should write event if it is non-zero', () => {
        const fromState = createMockState();
        const toState = createMockState({ event: 1 }); // EV_PLAYER_TELEPORT

        const writer = new BinaryWriter();
        writeDeltaEntity(fromState, toState, writer, false, false);

        const stream = new BinaryStream(writer.getData().buffer);
        const bits = stream.readByte();
        expect(bits).toBe(EntityFlags.U_EVENT);
        expect(stream.readByte()).toBe(1);
        expect(stream.hasMore()).toBe(false);
    });
});
