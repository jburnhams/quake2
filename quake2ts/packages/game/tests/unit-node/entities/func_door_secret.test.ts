import { describe, it, expect, vi, beforeEach } from 'vitest';
import { func_door_secret } from '../../../src/entities/funcs.js';
import { MoveType, Solid, ServerFlags } from '../../../src/entities/entity.js';
import { createTestContext, createEntity } from '@quake2ts/test-utils';
import { Vec3 } from '@quake2ts/shared';
import { Entity } from '../../../src/entities/entity.js';

vi.mock('@quake2ts/shared', async () => {
    const actual = await vi.importActual('@quake2ts/shared');
    return {
        ...actual,
        angleVectors: (angles: Vec3) => {
            if (angles.y === 0) {
                return {
                    forward: { x: 1, y: 0, z: 0 },
                    right: { x: 0, y: -1, z: 0 },
                    up: { x: 0, y: 0, z: 1 }
                };
            } else if (angles.y === 90) {
                return {
                    forward: { x: 0, y: 1, z: 0 },
                    right: { x: 1, y: 0, z: 0 },
                    up: { x: 0, y: 0, z: 1 }
                };
            }
            return {
                forward: { x: 1, y: 0, z: 0 },
                right: { x: 0, y: -1, z: 0 },
                up: { x: 0, y: 0, z: 1 }
            };
        },
        dotVec3: (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z,
    };
});

describe('func_door_secret', () => {
    let entity: Entity;
    let context: any;

    beforeEach(() => {
        context = createTestContext();
        entity = createEntity({
            origin: { x: 100, y: 100, z: 100 },
            angles: { x: 0, y: 0, z: 0 },
            size: { x: 32, y: 32, z: 64 },
            mins: { x: 0, y: 0, z: 0 },
            maxs: { x: 32, y: 32, z: 64 },
        });
        context.entities.timeSeconds = 10;
    });

    it('should initialize correctly and calculate positions', () => {
        func_door_secret(entity, context);

        expect(entity.movetype).toBe(MoveType.Push);
        expect(entity.solid).toBe(Solid.Bsp);
        expect(entity.svflags & ServerFlags.Door).toBeTruthy();

        expect(entity.pos1).toEqual({ x: 100, y: 68, z: 100 });
        expect(entity.pos2).toEqual({ x: 132, y: 68, z: 100 });
    });

    it('should trigger movement sequence when used', () => {
        func_door_secret(entity, context);

        entity.use?.(entity, null, null);

        expect(context.entities.scheduleThink).toHaveBeenCalled();
        expect(entity.velocity).not.toEqual({ x: 0, y: 0, z: 0 });
        expect(entity.think).toBeDefined();

        let maxIterations = 100;
        while (maxIterations-- > 0 && entity.think) {
            entity.think(entity, context.entities);
            if (entity.velocity.x === 0 && entity.velocity.y === 0 && entity.velocity.z === 0) break;
        }

        expect(entity.origin).toEqual(entity.pos1);
        expect(entity.velocity).toEqual({ x: 0, y: 0, z: 0 });
        expect(entity.nextthink).toBeGreaterThanOrEqual(context.entities.timeSeconds);

        const move2Callback = entity.think;
        if (move2Callback) {
            move2Callback(entity, context.entities);
            expect(entity.velocity).not.toEqual({ x: 0, y: 0, z: 0 });

            maxIterations = 100;
            while (maxIterations-- > 0 && entity.think) {
                entity.think(entity, context.entities);
                if (entity.velocity.x === 0 && entity.velocity.y === 0 && entity.velocity.z === 0) break;
            }

            expect(entity.origin).toEqual(entity.pos2);
            expect(entity.nextthink).toBeGreaterThan(context.entities.timeSeconds);

            const move4Setup = entity.think;
            if (move4Setup) {
                move4Setup(entity, context.entities);
                maxIterations = 100;
                while (maxIterations-- > 0 && entity.think) {
                    entity.think(entity, context.entities);
                    if (entity.velocity.x === 0 && entity.velocity.y === 0 && entity.velocity.z === 0) break;
                }
                expect(entity.origin).toEqual(entity.pos1);

                const move6Setup = entity.think;
                if (move6Setup) {
                    move6Setup(entity, context.entities);
                    maxIterations = 100;
                    while (maxIterations-- > 0 && entity.think) {
                        entity.think(entity, context.entities);
                        if (entity.velocity.x === 0 && entity.velocity.y === 0 && entity.velocity.z === 0) break;
                    }
                    expect(entity.origin).toEqual({ x: 100, y: 100, z: 100 });
                }
            }
        }
    });
});
