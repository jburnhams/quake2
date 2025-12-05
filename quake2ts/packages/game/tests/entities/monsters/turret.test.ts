import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTurretSpawns } from '../../../src/entities/monsters/turret.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { SpawnContext, SpawnRegistry } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { GameEngine } from '../../../src/index.js';
import { monster_fire_blaster } from '../../../src/entities/monsters/attack.js';

// Mock dependencies
vi.mock('../../../src/entities/monsters/attack.js', () => ({
  monster_fire_blaster: vi.fn(),
}));

describe('monster_turret', () => {
  let sys: EntitySystem;
  let context: SpawnContext;
  let turret: Entity;
  let spawnRegistry: SpawnRegistry;

  beforeEach(() => {
    const engineMock = {
        sound: vi.fn(),
    } as unknown as GameEngine;

    sys = {
        spawn: () => new Entity(1),
        modelIndex: (s: string) => 1,
        timeSeconds: 10,
        multicast: vi.fn(),
        engine: engineMock,
    } as unknown as EntitySystem;

    context = {
        entities: sys,
        health_multiplier: 1.0,
        keyValues: {},
    } as unknown as SpawnContext;

    turret = new Entity(1);

    spawnRegistry = {
        register: vi.fn(),
    } as unknown as SpawnRegistry;

    vi.clearAllMocks();
  });

  it('registerTurretSpawns registers monster_turret', () => {
    registerTurretSpawns(spawnRegistry);
    expect(spawnRegistry.register).toHaveBeenCalledWith('monster_turret', expect.any(Function));
  });

  it('SP_monster_turret sets default properties', () => {
    registerTurretSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];

    spawnFn(turret, context);

    expect(turret.model).toBe('models/monsters/turret/tris.md2');
    expect(turret.health).toBe(100);
    expect(turret.solid).toBe(Solid.BoundingBox);
    expect(turret.movetype).toBe(MoveType.Step);
    expect(turret.monsterinfo.stand).toBeDefined();
    expect(turret.monsterinfo.attack).toBeDefined();
  });

  it('turret attack fires blaster', () => {
    registerTurretSpawns(spawnRegistry);
    const spawnFn = (spawnRegistry.register as any).mock.calls[0][1];
    spawnFn(turret, context);

    turret.enemy = new Entity(2);
    turret.enemy.origin = { x: 100, y: 0, z: 0 };
    turret.origin = { x: 0, y: 0, z: 0 };

    turret.monsterinfo.attack!(turret, context as any);
    const move = turret.monsterinfo.current_move;

    // Check frame 4 (index 4, 5th frame)
    const fireFn = move!.frames[4].think;
    expect(fireFn).toBeDefined();

    fireFn!(turret, sys);

    expect(monster_fire_blaster).toHaveBeenCalledWith(
        turret,
        expect.anything(),
        expect.anything(),
        2, // damage
        1000, // speed
        1, // effect
        0,
        sys
    );
  });
});
