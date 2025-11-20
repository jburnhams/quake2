import { describe, it, expect, vi } from 'vitest';
import { Entity, MoveType } from '../src/entities/entity';
import { applyGravity, bounce, moveProjectile, fixStuck, checkWater, clipVelocity } from '../src/physics/physics';
import { GameEngine } from '../src/index';
import { TraceResult, CONTENTS_WATER, Vec3 } from '@quake2ts/shared';

describe('applyGravity', () => {
    it('should apply gravity to an entity', () => {
        const entity = new Entity(0);
        entity.movetype = MoveType.Toss;
        entity.velocity = { x: 0, y: 0, z: 0 };
        entity.gravity = 1.0;

        applyGravity(entity, 1.0);

        expect(entity.velocity.z).toBe(-800);
    });

    it('should not apply gravity to a flying entity', () => {
        const entity = new Entity(0);
        entity.movetype = MoveType.Fly;
        entity.velocity = { x: 0, y: 0, z: 0 };
        entity.gravity = 1.0;

        applyGravity(entity, 1.0);

        expect(entity.velocity.z).toBe(0);
    });
});

describe('bounce', () => {
    it('should reflect the entity velocity off the hit plane', () => {
        const entity = new Entity(0);
        entity.movetype = MoveType.Bounce;
        entity.velocity = { x: 0, y: 0, z: -100 };

        const trace: TraceResult = {
            fraction: 0.5,
            plane: {
                normal: { x: 0, y: 0, z: 1 },
                dist: 0,
            },
            surfaceFlags: 0,
            contents: 0,
            allsolid: false,
            startsolid: false,
        };

        bounce(entity, trace);

        expect(entity.velocity.z).toBeGreaterThan(0);
    });
});

describe('moveProjectile', () => {
    it('should explode when it hits a wall', () => {
        const entity = new Entity(0);
        entity.movetype = MoveType.FlyMissile;
        entity.velocity = { x: 100, y: 0, z: 0 };
        entity.origin = { x: 0, y: 0, z: 0 };

        const mockTraceResult: TraceResult = {
            fraction: 0.5,
            endpos: { x: 50, y: 0, z: 0 },
            plane: {
                normal: { x: -1, y: 0, z: 0 },
                dist: 50,
            },
            surfaceFlags: 0,
            contents: 0,
            allsolid: false,
            startsolid: false,
        };

        const mockGameEngine: GameEngine = {
            trace: vi.fn().mockReturnValue(mockTraceResult),
        };

        const mockEntitySystem = {
            free: vi.fn(),
        };

        moveProjectile(mockGameEngine, mockEntitySystem, entity, 1.0);

        expect(mockEntitySystem.free).toHaveBeenCalledWith(entity);
    });

    it('should continue flying if it does not hit a wall', () => {
        const entity = new Entity(0);
        entity.movetype = MoveType.FlyMissile;
        entity.velocity = { x: 100, y: 0, z: 0 };
        entity.origin = { x: 0, y: 0, z: 0 };

        const mockTraceResult: TraceResult = {
            fraction: 1.0,
            endpos: { x: 100, y: 0, z: 0 },
            plane: null,
            surfaceFlags: 0,
            contents: 0,
            allsolid: false,
            startsolid: false,
        };

        const mockGameEngine: GameEngine = {
            trace: vi.fn().mockReturnValue(mockTraceResult),
        };

        const mockEntitySystem = {
            free: vi.fn(),
        };

        moveProjectile(mockGameEngine, mockEntitySystem, entity, 1.0);

        expect(entity.origin.x).toBe(100);
        expect(mockEntitySystem.free).not.toHaveBeenCalled();
    });
});

describe('fixStuck', () => {
    it('should move the entity out of a solid object', () => {
        const entity = new Entity(0);
        entity.origin = { x: 0, y: 0, z: 0 };

        const mockTraceResult: TraceResult = {
            fraction: 0.5,
            endpos: { x: 0.5, y: 0, z: 0 },
            plane: {
                normal: { x: -1, y: 0, z: 0 },
                dist: 0.5,
            },
            surfaceFlags: 0,
            contents: 0,
            allsolid: false,
            startsolid: true,
        };

        const mockGameEngine: GameEngine = {
            trace: vi.fn().mockImplementation((start, end) => {
                if (end.x > 0) {
                    return mockTraceResult;
                }
                return {
                    fraction: 1.0,
                    endpos: end,
                    plane: null,
                    surfaceFlags: 0,
                    contents: 0,
                    allsolid: false,
                    startsolid: false,
                };
            }),
        };

        fixStuck(mockGameEngine, entity);

        expect(entity.origin.x).toBeLessThan(0);
    });
});

describe('checkWater', () => {
    it('should set the waterlevel and watertype correctly', () => {
        const entity = new Entity(0);
        entity.origin = { x: 0, y: 0, z: 0 };
        entity.mins = { x: -16, y: -16, z: -24 };
        entity.maxs = { x: 16, y: 16, z: 32 };

        const mockGameEngine: GameEngine = {
            pointcontents: vi.fn().mockImplementation((point: Vec3) => {
                if (point.z <= 0) {
                    return CONTENTS_WATER;
                }
                return 0;
            }),
        };

        checkWater(mockGameEngine, entity);

        expect(entity.waterlevel).toBe(2);
        expect(entity.watertype).toBe(CONTENTS_WATER);
    });
});

describe('clipVelocity', () => {
    it('should reflect the velocity off the plane', () => {
        const vel = { x: 0, y: 0, z: -100 };
        const normal = { x: 0, y: 0, z: 1 };
        const newVel = clipVelocity(vel, normal, 1.5);
        expect(newVel.z).toBeGreaterThan(0);
    });
});
