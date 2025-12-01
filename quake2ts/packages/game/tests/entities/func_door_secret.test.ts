import { describe, it, expect, vi, beforeEach } from 'vitest';
import { func_door_secret } from '../../../src/entities/funcs.js';
import { Entity, MoveType, Solid, EntityFlags, ServerFlags } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { Vec3 } from '@quake2ts/shared';

// Mock angleVectors since it's used in SP_func_door_secret
vi.mock('@quake2ts/shared', async () => {
    const actual = await vi.importActual('@quake2ts/shared');
    return {
        ...actual,
        angleVectors: (angles: Vec3, forward: Vec3, right: Vec3, up: Vec3) => {
            // Simple mock: assume angles 0,0,0 implies forward=x, right=-y, up=z for quake coords?
            // Actually Quake: Forward X, Left Y, Up Z. Right is -Y.
            // But let's just make it deterministic for the test.
            if (angles.y === 0) {
                forward.x = 1; forward.y = 0; forward.z = 0;
                right.x = 0; right.y = -1; right.z = 0;
                up.x = 0; up.y = 0; up.z = 1;
            } else if (angles.y === 90) {
                forward.x = 0; forward.y = 1; forward.z = 0;
                right.x = 1; right.y = 0; right.z = 0;
                up.x = 0; up.y = 0; up.z = 1;
            }
        },
        dotVec3: (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z,
    };
});

describe('func_door_secret', () => {
    let entity: Entity;
    let context: EntitySystem;

    beforeEach(() => {
        entity = new Entity();
        entity.origin = { x: 100, y: 100, z: 100 };
        entity.angles = { x: 0, y: 0, z: 0 };
        entity.size = { x: 32, y: 32, z: 64 };
        entity.mins = { x: 0, y: 0, z: 0 };
        entity.maxs = { x: 32, y: 32, z: 64 };

        context = {
            entities: {
                scheduleThink: vi.fn((ent, time) => {
                    ent.nextthink = time;
                }),
                linkentity: vi.fn(),
                sound: vi.fn(),
            },
            timeSeconds: 10,
        } as any;
        // Circular reference for move_calc passing context.entities
        (context as any).entities.entities = context.entities;
    });

    it('should initialize correctly and calculate positions', () => {
        func_door_secret(entity, context);

        expect(entity.movetype).toBe(MoveType.Push);
        expect(entity.solid).toBe(Solid.Bsp);
        expect(entity.svflags & ServerFlags.Door).toBeTruthy();

        // Right = (0, -1, 0). Width = 32. Move = Right * 32 = (0, -32, 0).
        // Pos1 = (100, 68, 100).
        expect(entity.pos1).toEqual({ x: 100, y: 68, z: 100 });

        // Forward = (1, 0, 0). Length = 32.
        // Pos2 = Pos1 + (32, 0, 0) = (132, 68, 100).
        expect(entity.pos2).toEqual({ x: 132, y: 68, z: 100 });
    });

    it('should trigger movement sequence when used', () => {
        func_door_secret(entity, context);

        // Trigger
        entity.use?.(entity, null, null);

        // Should start moving to pos1
        expect(context.entities.scheduleThink).toHaveBeenCalled();
        expect(entity.velocity).not.toEqual({ x: 0, y: 0, z: 0 });

        // Simulate completing move to pos1 (move_calc logic)
        // We can manually invoke the think callback if we want to test the full chain,
        // but `move_calc` logic is internal.
        // Instead, let's verify `think` is set.
        expect(entity.think).toBeDefined();

        // Manually simulate reaching destination for move1
        // The think callback set by move_calc calls `done` which is `door_secret_move1`

        // Let's mock move_calc behavior? No, we are testing integration with it.
        // move_calc sets velocity and schedules think.
        // If we call the think callback, it should set origin to dest and call done.

        const moveCallback = entity.think;
        if (moveCallback) {
            moveCallback(entity, context.entities);
            // After reaching pos1, `door_secret_move1` is called.
            // It sets nextthink = time + 1.0 and think = door_secret_move2.

            expect(entity.origin).toEqual(entity.pos1);
            expect(entity.velocity).toEqual({ x: 0, y: 0, z: 0 });
            expect(entity.nextthink).toBe(context.timeSeconds + 1.0);

            // Invoke move2
            const move2Callback = entity.think;
            if (move2Callback) {
                // context.timeSeconds should advance in real game, but here we just call it.
                // context passed to think is EntitySystem
                move2Callback(entity, context.entities);

                // Now moving to pos2 (door_secret_move2 -> move_calc(pos2))
                expect(entity.velocity).not.toEqual({ x: 0, y: 0, z: 0 });
                // Simulate reaching pos2
                const move2Done = entity.think;
                if (move2Done) {
                    move2Done(entity, context.entities);
                    expect(entity.origin).toEqual(entity.pos2);

                    // Now `door_secret_move3` called (wait phase)
                    // If wait is not -1, it schedules move4
                    expect(entity.nextthink).toBeGreaterThan(context.timeSeconds);

                    const move4Setup = entity.think;
                    if (move4Setup) {
                        move4Setup(entity, context.entities);
                        // move4 calls move_calc(pos1)
                        const move4Done = entity.think;
                        if (move4Done) {
                            move4Done(entity, context.entities);
                            expect(entity.origin).toEqual(entity.pos1);

                            // move5 -> wait 1s -> move6
                            const move6Setup = entity.think;
                            if (move6Setup) {
                                move6Setup(entity, context.entities);
                                // move6 -> move_calc(start_origin)
                                const move6Done = entity.think;
                                if (move6Done) {
                                    move6Done(entity, context.entities);
                                    // Back to start
                                    expect(entity.origin).toEqual({ x: 100, y: 100, z: 100 });
                                }
                            }
                        }
                    }
                }
            }
        }
    });
});
