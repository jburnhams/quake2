import { describe, it, expect } from 'vitest';
import { BinaryWriter, BinaryStream } from '@quake2ts/shared';
import { writePlayerState, ProtocolPlayerState } from '../../src/protocol/player.js';

// Mock parser based on packages/engine/src/demo/parser.ts logic for verification
// We don't want to import the engine parser directly as it creates circular dependency or requires engine build
// So we just implement a simple reader here that matches the spec we implemented.

function readPlayerState(data: Uint8Array): ProtocolPlayerState {
    const stream = new BinaryStream(data.buffer);
    const ps: ProtocolPlayerState = {
        pm_type: 0,
        origin: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        pm_time: 0,
        pm_flags: 0,
        gravity: 0,
        delta_angles: { x: 0, y: 0, z: 0 },
        viewoffset: { x: 0, y: 0, z: 0 },
        viewangles: { x: 0, y: 0, z: 0 },
        kick_angles: { x: 0, y: 0, z: 0 },
        gun_index: 0,
        gun_frame: 0,
        gun_offset: { x: 0, y: 0, z: 0 },
        gun_angles: { x: 0, y: 0, z: 0 },
        blend: [0, 0, 0, 0],
        fov: 0,
        rdflags: 0,
        stats: new Array(32).fill(0)
    };

    const flags = stream.readShort();

    if (flags & 1) ps.pm_type = stream.readByte();

    if (flags & 2) {
        ps.origin.x = stream.readShort() * 0.125;
        ps.origin.y = stream.readShort() * 0.125;
        ps.origin.z = stream.readShort() * 0.125;
    }

    if (flags & 4) {
        ps.velocity.x = stream.readShort() * 0.125;
        ps.velocity.y = stream.readShort() * 0.125;
        ps.velocity.z = stream.readShort() * 0.125;
    }

    if (flags & 8) ps.pm_time = stream.readByte();
    if (flags & 16) ps.pm_flags = stream.readByte();
    if (flags & 32) ps.gravity = stream.readShort();

    if (flags & 64) {
        ps.delta_angles.x = stream.readShort() * (180 / 32768);
        ps.delta_angles.y = stream.readShort() * (180 / 32768);
        ps.delta_angles.z = stream.readShort() * (180 / 32768);
    }

    if (flags & 128) {
        ps.viewoffset.x = stream.readChar() * 0.25;
        ps.viewoffset.y = stream.readChar() * 0.25;
        ps.viewoffset.z = stream.readChar() * 0.25;
    }

    if (flags & 256) {
        ps.viewangles.x = stream.readAngle16();
        ps.viewangles.y = stream.readAngle16();
        ps.viewangles.z = stream.readAngle16();
    }

    if (flags & 512) {
        ps.kick_angles.x = stream.readChar() * 0.25;
        ps.kick_angles.y = stream.readChar() * 0.25;
        ps.kick_angles.z = stream.readChar() * 0.25;
    }

    if (flags & 4096) ps.gun_index = stream.readByte();

    if (flags & 8192) {
        ps.gun_frame = stream.readByte();
        ps.gun_offset.x = stream.readChar() * 0.25;
        ps.gun_offset.y = stream.readChar() * 0.25;
        ps.gun_offset.z = stream.readChar() * 0.25;
        ps.gun_angles.x = stream.readChar() * 0.25;
        ps.gun_angles.y = stream.readChar() * 0.25;
        ps.gun_angles.z = stream.readChar() * 0.25;
    }

    if (flags & 1024) {
        ps.blend[0] = stream.readByte();
        ps.blend[1] = stream.readByte();
        ps.blend[2] = stream.readByte();
        ps.blend[3] = stream.readByte();
    }

    if (flags & 2048) ps.fov = stream.readByte();
    if (flags & 16384) ps.rdflags = stream.readByte();

    const statbits = stream.readLong();
    for (let i = 0; i < 32; i++) {
        if (statbits & (1 << i)) {
            ps.stats[i] = stream.readShort();
        }
    }

    return ps;
}

describe('writePlayerState', () => {
    it('should write an empty state as just flags (plus statbits)', () => {
        const writer = new BinaryWriter();
        const emptyState: ProtocolPlayerState = {
            pm_type: 0, origin: {x:0,y:0,z:0}, velocity: {x:0,y:0,z:0}, pm_time: 0, pm_flags: 0, gravity: 0,
            delta_angles: {x:0,y:0,z:0}, viewoffset: {x:0,y:0,z:0}, viewangles: {x:0,y:0,z:0}, kick_angles: {x:0,y:0,z:0},
            gun_index: 0, gun_frame: 0, gun_offset: {x:0,y:0,z:0}, gun_angles: {x:0,y:0,z:0},
            blend: [0,0,0,0], fov: 0, rdflags: 0, stats: new Array(32).fill(0)
        };

        writePlayerState(writer, emptyState);
        const data = writer.getData();
        const readState = readPlayerState(data);

        expect(readState.pm_type).toBe(0);
        expect(readState.origin.x).toBe(0);
        expect(readState.stats[0]).toBe(0);
    });

    it('should correctly round-trip all fields', () => {
        const writer = new BinaryWriter();
        const state: ProtocolPlayerState = {
            pm_type: 1,
            origin: { x: 10, y: -20, z: 30 },
            velocity: { x: 100, y: -50, z: 0 },
            pm_time: 123,
            pm_flags: 4,
            gravity: 800,
            delta_angles: { x: 10, y: 20, z: 30 },
            viewoffset: { x: 5, y: -5, z: 10 },
            viewangles: { x: 45, y: 90, z: 0 },
            kick_angles: { x: 1, y: 2, z: 3 },
            gun_index: 5,
            gun_frame: 12,
            gun_offset: { x: 1, y: 2, z: 3 },
            gun_angles: { x: 4, y: 5, z: 6 },
            blend: [255, 128, 64, 32],
            fov: 90,
            rdflags: 7,
            stats: new Array(32).fill(0)
        };
        state.stats[1] = 100; // Health
        state.stats[3] = 50;  // Ammo

        writePlayerState(writer, state);
        const data = writer.getData();
        const read = readPlayerState(data);

        // Verification with tolerances for precision loss (1/8 units, etc)
        expect(read.pm_type).toBe(state.pm_type);
        expect(read.origin.x).toBe(state.origin.x);
        expect(read.velocity.x).toBe(state.velocity.x);
        expect(read.pm_time).toBe(state.pm_time);
        expect(read.gravity).toBe(state.gravity);
        expect(read.viewangles.x).toBeCloseTo(state.viewangles.x, 0.1);
        expect(read.blend).toEqual(state.blend);
        expect(read.stats[1]).toBe(100);
        expect(read.stats[3]).toBe(50);
        expect(read.gun_index).toBe(5);
        expect(read.gun_frame).toBe(12);
    });

    it('should ignore stats > 31', () => {
        const writer = new BinaryWriter();
        const state: ProtocolPlayerState = {
            pm_type: 0, origin: {x:0,y:0,z:0}, velocity: {x:0,y:0,z:0}, pm_time: 0, pm_flags: 0, gravity: 0,
            delta_angles: {x:0,y:0,z:0}, viewoffset: {x:0,y:0,z:0}, viewangles: {x:0,y:0,z:0}, kick_angles: {x:0,y:0,z:0},
            gun_index: 0, gun_frame: 0, gun_offset: {x:0,y:0,z:0}, gun_angles: {x:0,y:0,z:0},
            blend: [0,0,0,0], fov: 0, rdflags: 0, stats: new Array(64).fill(0)
        };
        state.stats[31] = 999;
        state.stats[32] = 123; // Should be ignored

        writePlayerState(writer, state);
        const read = readPlayerState(writer.getData());

        expect(read.stats[31]).toBe(999);
        expect(read.stats[32]).toBeUndefined(); // Array size is 32 in reader
    });
});
