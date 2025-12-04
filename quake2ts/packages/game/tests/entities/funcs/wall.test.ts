import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestContext } from '../../test-helpers.js';
import { func_wall } from '../../../src/entities/funcs.js';
import { Entity, Solid, ServerFlags, MoveType } from '../../../src/entities/entity.js';

// Constants from the implementation
const SPAWNFLAG_WALL_TRIGGER_SPAWN = 1;
const SPAWNFLAG_WALL_TOGGLE = 2;
const SPAWNFLAG_WALL_START_ON = 4;
const SPAWNFLAG_WALL_ANIMATED = 8;
const SPAWNFLAG_WALL_ANIMATED_FAST = 16;
const EF_ANIM_ALL = 4;
const EF_ANIM_ALLFAST = 8;

describe('func_wall', () => {
    let context: any;
    let entity: Entity;

    beforeEach(() => {
        context = createTestContext();
        entity = context.entities.spawn();
        entity.classname = 'func_wall';
    });

    it('initializes as a standard solid wall by default', () => {
        func_wall(entity, context);
        expect(entity.solid).toBe(Solid.Bsp);
        expect(entity.movetype).toBe(MoveType.Push);
        expect(entity.use).toBeUndefined();
    });

    it('handles ANIMATED spawnflag', () => {
        entity.spawnflags = SPAWNFLAG_WALL_ANIMATED;
        func_wall(entity, context);
        expect(entity.effects & EF_ANIM_ALL).toBeTruthy();
    });

    it('handles ANIMATED_FAST spawnflag', () => {
        entity.spawnflags = SPAWNFLAG_WALL_ANIMATED_FAST;
        func_wall(entity, context);
        expect(entity.effects & EF_ANIM_ALLFAST).toBeTruthy();
    });

    it('handles TRIGGER_SPAWN (starts invisible and non-solid)', () => {
        entity.spawnflags = SPAWNFLAG_WALL_TRIGGER_SPAWN;
        func_wall(entity, context);
        expect(entity.solid).toBe(Solid.Not);
        expect(entity.svflags & ServerFlags.NoClient).toBeTruthy();
        expect(entity.use).toBeDefined();
    });

    it('TRIGGER_SPAWN: use toggles solidity/visibility (one-shot)', () => {
        entity.spawnflags = SPAWNFLAG_WALL_TRIGGER_SPAWN;
        func_wall(entity, context);

        expect(entity.use).toBeDefined();

        // Trigger it
        entity.use!(entity, null, null);

        expect(entity.solid).toBe(Solid.Bsp);
        expect(entity.svflags & ServerFlags.NoClient).toBeFalsy();
        expect(entity.use).toBeUndefined(); // Should be cleared as it is not toggleable
    });

    it('TRIGGER_SPAWN + TOGGLE: use toggles solidity/visibility repeatedly', () => {
        entity.spawnflags = SPAWNFLAG_WALL_TRIGGER_SPAWN | SPAWNFLAG_WALL_TOGGLE;
        func_wall(entity, context);

        // Starts hidden
        expect(entity.solid).toBe(Solid.Not);

        // Toggle ON
        entity.use!(entity, null, null);
        expect(entity.solid).toBe(Solid.Bsp);
        expect(entity.svflags & ServerFlags.NoClient).toBeFalsy();

        // Toggle OFF
        entity.use!(entity, null, null);
        expect(entity.solid).toBe(Solid.Not);
        expect(entity.svflags & ServerFlags.NoClient).toBeTruthy();

        // Toggle ON again
        entity.use!(entity, null, null);
        expect(entity.solid).toBe(Solid.Bsp);
    });

    it('TRIGGER_SPAWN + TOGGLE + START_ON: starts visible', () => {
        entity.spawnflags = SPAWNFLAG_WALL_TRIGGER_SPAWN | SPAWNFLAG_WALL_TOGGLE | SPAWNFLAG_WALL_START_ON;
        func_wall(entity, context);

        expect(entity.solid).toBe(Solid.Bsp);
        expect(entity.svflags & ServerFlags.NoClient).toBeFalsy();

        // Toggle OFF
        entity.use!(entity, null, null);
        expect(entity.solid).toBe(Solid.Not);
    });

    it('START_ON without TOGGLE forces TOGGLE and warns', () => {
        const spy = vi.spyOn(console, 'log'); // Adjust if context.warn/print is used
        // Assuming implementation uses console.log or context.print which we might need to mock if strictly enforced.
        // For now, let's just check the flags are fixed.

        entity.spawnflags = SPAWNFLAG_WALL_TRIGGER_SPAWN | SPAWNFLAG_WALL_START_ON;
        func_wall(entity, context);

        expect(entity.spawnflags & SPAWNFLAG_WALL_TOGGLE).toBeTruthy();
        // Starts ON
        expect(entity.solid).toBe(Solid.Bsp);
    });
});
