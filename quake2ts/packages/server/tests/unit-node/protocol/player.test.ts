import { describe, it, expect } from 'vitest';
import { BinaryWriter } from '@quake2ts/shared';
import { writePlayerState, ProtocolPlayerState } from '../../../src/protocol/player.js';
import { parseProtocolPlayerState } from '@quake2ts/test-utils';

describe('writePlayerState', () => {
    it('should write an empty state as just flags (plus statbits)', () => {
        const writer = new BinaryWriter();
        const emptyState: ProtocolPlayerState = {
            pm_type: 0, origin: {x:0,y:0,z:0}, velocity: {x:0,y:0,z:0}, pm_time: 0, pm_flags: 0, gravity: 0,
            delta_angles: {x:0,y:0,z:0}, viewoffset: {x:0,y:0,z:0}, viewangles: {x:0,y:0,z:0}, kick_angles: {x:0,y:0,z:0},
            gun_index: 0, gun_frame: 0, gun_offset: {x:0,y:0,z:0}, gun_angles: {x:0,y:0,z:0},
            blend: [0,0,0,0], fov: 0, rdflags: 0, stats: new Array(32).fill(0), watertype: 0
        };

        writePlayerState(writer, emptyState);
        const data = writer.getData();
        const readState = parseProtocolPlayerState(data);

        expect(readState.pm_type).toBe(0);
        expect(readState.origin.x).toBe(0);
        expect(readState.stats[0]).toBe(0);
        expect(readState.watertype).toBe(0);
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
            stats: new Array(32).fill(0),
            watertype: 128 // Custom flag
        };
        state.stats[1] = 100; // Health
        state.stats[3] = 50;  // Ammo

        writePlayerState(writer, state);
        const data = writer.getData();
        const read = parseProtocolPlayerState(data);

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
        expect(read.watertype).toBe(128);
    });

    it('should ignore stats > 31', () => {
        const writer = new BinaryWriter();
        const state: ProtocolPlayerState = {
            pm_type: 0, origin: {x:0,y:0,z:0}, velocity: {x:0,y:0,z:0}, pm_time: 0, pm_flags: 0, gravity: 0,
            delta_angles: {x:0,y:0,z:0}, viewoffset: {x:0,y:0,z:0}, viewangles: {x:0,y:0,z:0}, kick_angles: {x:0,y:0,z:0},
            gun_index: 0, gun_frame: 0, gun_offset: {x:0,y:0,z:0}, gun_angles: {x:0,y:0,z:0},
            blend: [0,0,0,0], fov: 0, rdflags: 0, stats: new Array(64).fill(0), watertype: 0
        };
        state.stats[31] = 999;
        state.stats[32] = 123; // Should be ignored

        writePlayerState(writer, state);
        const read = parseProtocolPlayerState(writer.getData());

        expect(read.stats[31]).toBe(999);
        expect(read.stats[32]).toBeUndefined(); // Array size is 32 in reader
    });
});
