import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySelection, EntityHit, EntityConnection } from '../../../src/entities/selection.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity, Solid } from '../../../src/entities/entity.js';
import { Vec3, normalizeVec3, addVec3, scaleVec3 } from '@quake2ts/shared';

// Mock dependencies
vi.mock('../../../src/entities/system.js');
vi.mock('../../../src/entities/entity.js');
// Important: Ensure shared math works as expected
vi.mock('@quake2ts/shared', async () => {
    const actual = await vi.importActual('@quake2ts/shared') as any;
    return {
        ...actual,
        // Ensure vector operations work correctly if needed
    };
});

describe('EntitySelection', () => {
    let system: EntitySystem;
    let selection: EntitySelection;
    let mockTraceModel: any;

    beforeEach(() => {
        // Mock EntitySystem
        mockTraceModel = vi.fn();
        system = new (EntitySystem as any)();
        (system as any).imports = {
            traceModel: mockTraceModel
        };

        // Mock entities pool
        const entities: Entity[] = [];
        (system as any).forEachEntity = (cb: (e: Entity) => void) => {
            entities.forEach(cb);
        };
        (system as any).getByIndex = (index: number) => {
             return entities.find(e => e.index === index);
        };
        (system as any).findByTargetName = (name: string) => {
            return entities.filter(e => e.targetname === name);
        };

        // Add helper to populate entities
        (system as any).addEntity = (e: Entity) => entities.push(e);

        selection = new EntitySelection(system);
    });

    describe('rayCastEntities', () => {
        it('should detect hits on standard AABB entities', () => {
            const entity = {
                index: 1,
                origin: { x: 100, y: 0, z: 0 },
                mins: { x: -10, y: -10, z: -10 },
                maxs: { x: 10, y: 10, z: 10 },
                absmin: { x: 90, y: -10, z: -10 }, // Computed usually, but we provide it for mock
                absmax: { x: 110, y: 10, z: 10 },
                model: undefined
            } as any;
            (system as any).addEntity(entity);

            const origin = { x: 0, y: 0, z: 0 };
            const dir = { x: 1, y: 0, z: 0 }; // Pointing at entity

            const hits = selection.rayCastEntities(origin, dir);
            expect(hits.length).toBe(1);
            expect(hits[0].entity).toBe(entity);
            expect(hits[0].fraction).toBeCloseTo(90 / 8192, 4); // 90 units away
        });

        it('should detect hits on rotated entities (OBB)', () => {
            // Rotated 90 degrees around Z (Yaw)
            // Original X axis becomes Y axis.
            // Original Y axis becomes -X axis.
            // Box is long in X: [-20, -5, -5] to [20, 5, 5]
            // Rotated: long in Y: [-5, -20, -5] to [5, 20, 5]
            const entity = {
                index: 10,
                origin: { x: 100, y: 0, z: 0 },
                angles: { x: 0, y: 90, z: 0 },
                mins: { x: -20, y: -5, z: -5 },
                maxs: { x: 20, y: 5, z: 5 },
                absmin: { x: 80, y: -20, z: -5 }, // Approx bounds for optimization
                absmax: { x: 120, y: 20, z: 5 },
            } as any;
            (system as any).addEntity(entity);

            const origin = { x: 0, y: 0, z: 0 };

            // Ray along X axis should hit the rotated box (width 10, from x=95 to x=105 in world space)
            // Wait, entity is at 100,0,0. Rotated 90 deg yaw.
            // Local box X is [-20, 20]. Local box Y is [-5, 5].
            // Rotated: X becomes Y, Y becomes -X.
            // Rotated box spans Y: [-20, 20], X: [-5, 5].
            // So world bounds around 100,0,0 are: X=[95, 105], Y=[-20, 20].

            const dir = { x: 1, y: 0, z: 0 };
            const hits = selection.rayCastEntities(origin, dir);

            expect(hits.length).toBe(1);
            expect(hits[0].entity).toBe(entity);
            // Distance should be 100 - 5 = 95
            expect(hits[0].point.x).toBeCloseTo(95, 1);
        });

        it('should use traceModel for BSP entities', () => {
            const entity = {
                index: 2,
                model: '*1',
                origin: { x: 200, y: 0, z: 0 }
            } as any;
            (system as any).addEntity(entity);

            mockTraceModel.mockReturnValue({
                fraction: 0.5,
                endpos: { x: 150, y: 0, z: 0 },
                plane: { normal: { x: -1, y: 0, z: 0 } }
            });

            const origin = { x: 0, y: 0, z: 0 };
            const dir = { x: 1, y: 0, z: 0 };

            const hits = selection.rayCastEntities(origin, dir);

            expect(mockTraceModel).toHaveBeenCalled();
            expect(hits.length).toBe(1);
            expect(hits[0].fraction).toBe(0.5);
            expect(hits[0].entity).toBe(entity);
        });

        it('should respect AABB boundaries', () => {
             const entity = {
                index: 1,
                origin: { x: 100, y: 50, z: 0 }, // Offset Y
                mins: { x: -10, y: -10, z: -10 },
                maxs: { x: 10, y: 10, z: 10 },
                absmin: { x: 90, y: 40, z: -10 },
                absmax: { x: 110, y: 60, z: 10 },
            } as any;
            (system as any).addEntity(entity);

            const origin = { x: 0, y: 0, z: 0 };
            const dir = { x: 1, y: 0, z: 0 }; // Straight X, should miss Y=50

            const hits = selection.rayCastEntities(origin, dir);
            expect(hits.length).toBe(0);
        });
    });

    describe('getEntityMetadata', () => {
        it('should return metadata for valid entity', () => {
             const entity = {
                index: 42,
                classname: 'monster_ogre',
                origin: { x: 10, y: 20, z: 30 },
                angles: { x: 0, y: 90, z: 0 },
                spawnflags: 123
            } as any;
            (system as any).addEntity(entity);

            const meta = selection.getEntityMetadata(42);
            expect(meta).not.toBeNull();
            expect(meta!.id).toBe(42);
            expect(meta!.classname).toBe('monster_ogre');
            expect(meta!.origin).toEqual({ x: 10, y: 20, z: 30 });
            expect(meta!.spawnflags).toBe(123);
        });
    });

    describe('getEntityConnections', () => {
        it('should link target and targetname', () => {
            const source = {
                index: 1,
                classname: 'func_button',
                target: 'door1'
            } as any;
            const target = {
                index: 2,
                classname: 'func_door',
                targetname: 'door1'
            } as any;

            (system as any).addEntity(source);
            (system as any).addEntity(target);

            // Forward connection
            const connections1 = selection.getEntityConnections(1);
            expect(connections1).toContainEqual({ sourceId: 1, targetId: 2, type: 'target' });

            // Reverse connection
            const connections2 = selection.getEntityConnections(2);
            expect(connections2).toContainEqual({ sourceId: 1, targetId: 2, type: 'target' });
        });
    });

    describe('getEntityGraph', () => {
        it('should return graph nodes and edges', () => {
            const ent1 = { index: 1, classname: 'trigger', target: 't1' } as any;
            const ent2 = { index: 2, targetname: 't1', killtarget: 'k1' } as any;
            const ent3 = { index: 3, targetname: 'k1' } as any;

            (system as any).addEntity(ent1);
            (system as any).addEntity(ent2);
            (system as any).addEntity(ent3);

            const graph = selection.getEntityGraph();

            expect(graph.nodes.length).toBe(3);
            expect(graph.edges.length).toBe(2);

            expect(graph.edges).toContainEqual({ source: 1, target: 2, label: 'target' });
            expect(graph.edges).toContainEqual({ source: 2, target: 3, label: 'killtarget' });
        });
    });
});
