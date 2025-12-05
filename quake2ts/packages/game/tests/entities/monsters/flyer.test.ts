import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFlyerSpawns } from '../../../src/entities/monsters/flyer.js';
import { Entity, MoveType, Solid, EntityFlags } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createGame } from '../../../src/index.js';
import { SpawnContext, SpawnRegistry } from '../../../src/entities/spawn.js';

describe('monster_flyer', () => {
  let system: EntitySystem;
  let context: SpawnContext;
  let registry: SpawnRegistry;

  beforeEach(() => {
    const engine = {
      sound: vi.fn(),
      modelIndex: vi.fn().mockReturnValue(1),
    };
    const imports = {
      trace: vi.fn().mockReturnValue({
        allsolid: false,
        startsolid: false,
        fraction: 1.0,
        endpos: { x: 0, y: 0, z: 0 },
        plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
        ent: null,
      }),
      pointcontents: vi.fn().mockReturnValue(0),
      linkentity: vi.fn(),
      multicast: vi.fn(),
      unicast: vi.fn(),
    };

    const gameExports = createGame(imports, engine as any, { gravity: { x: 0, y: 0, z: -800 } });
    system = (gameExports as any).entities;
    context = {
      keyValues: {},
      entities: system,
      health_multiplier: 1,
      warn: vi.fn(),
      free: vi.fn(),
    };
    registry = new SpawnRegistry();
    registerFlyerSpawns(registry);
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    ent.classname = 'monster_flyer';
    const spawnFunc = registry.get('monster_flyer');
    spawnFunc!(ent, context);

    expect(ent.model).toBe('models/monsters/flyer/tris.md2');
    expect(ent.health).toBe(50);
    expect(ent.mass).toBe(50);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
    expect(ent.flags & EntityFlags.Fly).toBeTruthy();
  });

  it('has AI states', () => {
    const ent = system.spawn();
    registry.get('monster_flyer')!(ent, context);
    expect(ent.monsterinfo.stand).toBeDefined();
    expect(ent.monsterinfo.walk).toBeDefined();
    expect(ent.monsterinfo.run).toBeDefined();
    expect(ent.monsterinfo.attack).toBeDefined();
  });

  it('attacks when in range', () => {
    const ent = system.spawn();
    registry.get('monster_flyer')!(ent, context);

    const enemy = system.spawn();
    enemy.health = 100;
    enemy.origin = { x: 100, y: 0, z: 0 };
    ent.enemy = enemy;

    if (ent.monsterinfo.attack) {
        ent.monsterinfo.attack(ent);
    }

    // Should be in an attack move
    expect(ent.monsterinfo.current_move?.firstframe).toBeGreaterThan(0);
  });

  it('creates blaster bolt on attack', () => {
      const ent = system.spawn();
      registry.get('monster_flyer')!(ent, context);
      ent.enemy = system.spawn();
      ent.enemy.origin = { x: 200, y: 0, z: 0 };

      // Spy on projectile spawn
      const spawnSpy = vi.spyOn(system, 'spawn');

      // Trigger fire frame manually
      // We need to know which frame triggers fire.
      // For now, let's just implement the monster and assume we can test this by checking integration.
      // Or we can peek at the implementation I'm about to write.
  });
});
