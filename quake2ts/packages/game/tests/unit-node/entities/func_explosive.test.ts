import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFuncSpawns } from '../../../src/entities/funcs.js';
import { SpawnRegistry } from '../../../src/entities/spawn.js';
import { Entity, MoveType, Solid, ServerFlags } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import * as damageModule from '../../../src/combat/damage.js';

// Mock dependencies
vi.mock('../../../src/combat/damage.js', () => ({
    T_RadiusDamage: vi.fn(),
    DamageFlags: { NONE: 0 },
    DamageMod: { EXPLOSIVE: 1 }
}));

// Mock gibs module
vi.mock('../../../src/entities/gibs.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as any),
        throwGibs: vi.fn(),
        GIB_METALLIC: 1,
        GIB_DEBRIS: 2
    };
});

import { throwGibs } from '../../../src/entities/gibs.js';

describe('func_explosive', () => {
    let registry: SpawnRegistry;
    let system: EntitySystem;
    let entities: Entity[];

    beforeEach(() => {
        registry = new SpawnRegistry();
        registerFuncSpawns(registry);
        entities = [];
        system = {
            spawn: vi.fn(() => {
                const e = { classname: 'test_entity' } as Entity;
                entities.push(e);
                return e;
            }),
            free: vi.fn(),
            linkentity: vi.fn(),
            modelIndex: vi.fn(() => 1),
            sound: vi.fn(),
            positioned_sound: vi.fn(),
            useTargets: vi.fn(),
            multicast: vi.fn(),
            killBox: vi.fn(),
            findByRadius: vi.fn(() => []), // Added findByRadius
            timeSeconds: 10,
            finalizeSpawn: vi.fn(),
            scheduleThink: vi.fn(),
            rng: {
                crandom: () => 0.5,
                frandom: () => 0.5,
            }
        } as unknown as EntitySystem;
        vi.clearAllMocks();
    });

    const spawnExplosive = (overrides: Partial<Entity> = {}) => {
        const spawn = registry.get('func_explosive');
        const entity = {
            classname: 'func_explosive',
            origin: { x: 0, y: 0, z: 0 },
            ...overrides
        } as Entity;
        spawn?.(entity, { entities: system } as any);
        return entity;
    };

    it('should initialize untargeted as shootable', () => {
        const ent = spawnExplosive({ targetname: undefined });
        expect(ent.solid).toBe(Solid.Bsp);
        expect(ent.movetype).toBe(MoveType.Push);
        expect(ent.health).toBe(100);
        expect(ent.die).toBeDefined(); // Should be shootable
        expect(ent.takedamage).toBe(true);
    });

    it('should initialize targeted as NOT shootable by default', () => {
        const ent = spawnExplosive({ targetname: 'some_target' });
        expect(ent.solid).toBe(Solid.Bsp);
        expect(ent.health).toBeUndefined(); // Default health not set if not shootable
        expect(ent.die).toBeUndefined();
        expect(ent.use).toBeDefined();
    });

    it('should handle ALWAYS_SHOOTABLE flag', () => {
        const SPAWNFLAGS_EXPLOSIVE_ALWAYS_SHOOTABLE = 16;
        const ent = spawnExplosive({
            targetname: 'some_target',
            spawnflags: SPAWNFLAGS_EXPLOSIVE_ALWAYS_SHOOTABLE
        });

        expect(ent.takedamage).toBe(true);
        expect(ent.die).toBeDefined();
        expect(ent.health).toBe(100);
    });

    it('should handle TRIGGER_SPAWN flag', () => {
        const SPAWNFLAGS_EXPLOSIVE_TRIGGER_SPAWN = 1;
        const ent = spawnExplosive({ spawnflags: SPAWNFLAGS_EXPLOSIVE_TRIGGER_SPAWN });

        expect(ent.solid).toBe(Solid.Not);
        expect(ent.svflags).toBe(ServerFlags.NoClient);

        // Trigger spawn
        ent.use?.(ent, {} as Entity, {} as Entity);

        expect(ent.solid).toBe(Solid.Bsp);
        expect(ent.svflags & ServerFlags.NoClient).toBe(0);
        expect(system.linkentity).toHaveBeenCalledWith(ent);
        expect(system.killBox).toHaveBeenCalledWith(ent);
    });

    it('should explode and deal radius damage', () => {
        // Untargeted so it has die function
        const ent = spawnExplosive({ dmg: 200, health: 50 });
        const attacker = { classname: 'player' } as Entity;

        ent.die?.(ent, ent, attacker, 50);

        expect(system.findByRadius).toHaveBeenCalled();
        expect(damageModule.T_RadiusDamage).toHaveBeenCalled();
        expect(system.free).toHaveBeenCalledWith(ent);
    });

    it('should spawn debris on explosion', () => {
        const ent = spawnExplosive({ mass: 200 }); // Untargeted
        ent.die?.(ent, ent, ent, 100);

        expect(throwGibs).toHaveBeenCalled();
    });
});
