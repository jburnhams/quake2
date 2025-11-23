import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_gladiator } from '../../../src/entities/monsters/gladiator.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createGame } from '../../../src/index.js';
import { SpawnContext } from '../../../src/entities/spawn.js';

describe('monster_gladiator', () => {
  let system: EntitySystem;
  let context: SpawnContext;

  beforeEach(() => {
    // Mock game engine and imports
    const engine = {
      sound: vi.fn(),
      modelIndex: vi.fn().mockReturnValue(1),
    };
    const imports = {
      trace: vi.fn().mockReturnValue({
        allsolid: false,
        startsolid: false,
        fraction: 1,
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
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    SP_monster_gladiator(ent, context);

    expect(ent.classname).toBe('monster_gladiator');
    expect(ent.model).toBe('models/monsters/gladiatr/tris.md2');
    expect(ent.health).toBe(400);
    expect(ent.max_health).toBe(400);
    expect(ent.mass).toBe(400);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
  });

  it('enters stand state after spawn', () => {
    const ent = system.spawn();
    SP_monster_gladiator(ent, context);

    expect(ent.monsterinfo.current_move).toBeDefined();
    expect(ent.monsterinfo.current_move?.firstframe).toBe(0);
  });

  it('handles pain correctly', () => {
    const ent = system.spawn();
    SP_monster_gladiator(ent, context);
    ent.health = 100;

    ent.pain!(ent, system.world, 0, 10);
    expect(ent.monsterinfo.current_move?.firstframe).toBe(112);
  });

  it('handles death correctly', () => {
    const ent = system.spawn();
    SP_monster_gladiator(ent, context);

    ent.die!(ent, system.world, system.world, 500, { x: 0, y: 0, z: 0 });

    expect(ent.deadflag).toBe(1);
    expect(ent.solid).toBe(Solid.Not);
    expect(ent.monsterinfo.current_move?.firstframe).toBe(118);
  });
});
