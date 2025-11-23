import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerFlipperSpawns } from '../../../src/entities/monsters/flipper.js';
import { Entity, MoveType, Solid, EntityFlags } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createGame } from '../../../src/index.js';
import { SpawnContext, SpawnRegistry } from '../../../src/entities/spawn.js';

describe('monster_flipper', () => {
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
      warn: vi.fn(),
      free: vi.fn(),
    };
    registry = new SpawnRegistry();
    registerFlipperSpawns(registry);
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    ent.classname = 'monster_flipper';
    const spawnFunc = registry.get('monster_flipper');
    spawnFunc!(ent, context);

    expect(ent.model).toBe('models/monsters/flipper/tris.md2');
    expect(ent.health).toBe(50);
    expect(ent.mass).toBe(100);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
    expect(ent.flags & EntityFlags.Swim).toBeTruthy(); // Should have Swim flag
  });

  it('has AI states', () => {
    const ent = system.spawn();
    registry.get('monster_flipper')!(ent, context);
    expect(ent.monsterinfo.stand).toBeDefined();
    expect(ent.monsterinfo.walk).toBeDefined();
    expect(ent.monsterinfo.run).toBeDefined();
    expect(ent.monsterinfo.attack).toBeDefined();
  });

  it('attacks when in range', () => {
    const ent = system.spawn();
    registry.get('monster_flipper')!(ent, context);

    const enemy = system.spawn();
    enemy.health = 100;
    enemy.origin = { x: 50, y: 0, z: 0 };
    ent.enemy = enemy;

    if (ent.monsterinfo.attack) {
        ent.monsterinfo.attack(ent);
    }

    expect(ent.monsterinfo.current_move?.firstframe).toBeGreaterThan(0);
  });
});
