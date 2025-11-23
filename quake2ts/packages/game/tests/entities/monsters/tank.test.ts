import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_tank } from '../../../src/entities/monsters/tank.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createGame } from '../../../src/index.js';
import { SpawnContext } from '../../../src/entities/spawn.js';

describe('monster_tank', () => {
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
    SP_monster_tank(ent, context);

    expect(ent.classname).toBe('monster_tank');
    expect(ent.model).toBe('models/monsters/tank/tris.md2');
    expect(ent.health).toBe(750);
    expect(ent.max_health).toBe(750);
    expect(ent.mass).toBe(500);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
  });

  it('enters stand state after spawn', () => {
    const ent = system.spawn();
    SP_monster_tank(ent, context);

    expect(ent.monsterinfo.current_move).toBeDefined();
    expect(ent.monsterinfo.current_move?.firstframe).toBe(0);
  });

  it('handles pain correctly', () => {
    const ent = system.spawn();
    SP_monster_tank(ent, context);
    ent.health = 300; // Less than half health to trigger pain

    // Mock random to bypass the 50% chance to ignore low damage
    vi.spyOn(Math, 'random').mockReturnValue(0.6);

    // Damage > 10 ensures we don't hit the low damage ignore check
    ent.pain!(ent, system.world, 0, 20);
    expect(ent.monsterinfo.current_move?.firstframe).toBe(116);
  });

  it('handles death correctly', () => {
    const ent = system.spawn();
    SP_monster_tank(ent, context);

    ent.die!(ent, system.world, system.world, 800, { x: 0, y: 0, z: 0 });

    expect(ent.deadflag).toBe(DeadFlag.Dead);
    expect(ent.solid).toBe(Solid.Not);
    expect(ent.monsterinfo.current_move?.firstframe).toBe(122);
  });
});
