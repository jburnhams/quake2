import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_supertank } from '../../../src/entities/monsters/supertank.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createGame } from '../../../src/index.js';
import { SpawnContext } from '../../../src/entities/spawn.js';

describe('monster_supertank', () => {
  let system: EntitySystem;
  let context: SpawnContext;

  beforeEach(() => {
    // Mock game engine and imports
    const engine = {
      sound: vi.fn(),
      modelIndex: vi.fn().mockReturnValue(1),
      time: 10,
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
    SP_monster_supertank(ent, context);

    expect(ent.classname).toBe('monster_supertank');
    expect(ent.model).toBe('models/monsters/boss1/tris.md2');
    expect(ent.health).toBe(1500);
    expect(ent.max_health).toBe(1500);
    expect(ent.mass).toBe(800);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
  });

  it('enters stand state after spawn', () => {
    const ent = system.spawn();
    SP_monster_supertank(ent, context);

    // Stand frames 194-253
    expect(ent.monsterinfo.current_move).toBeDefined();
    expect(ent.monsterinfo.current_move?.firstframe).toBe(194);
  });

  it('handles pain correctly', () => {
    const ent = system.spawn();
    SP_monster_supertank(ent, context);

    // Test medium pain
    ent.pain!(ent, system.world, 0, 15);
    // Pain 2: 168
    expect(ent.monsterinfo.current_move?.firstframe).toBe(168);
  });

  it('handles heavy pain correctly', () => {
    const ent = system.spawn();
    SP_monster_supertank(ent, context);

    // Test heavy pain
    ent.pain!(ent, system.world, 0, 50);
    // Pain 3: 172
    expect(ent.monsterinfo.current_move?.firstframe).toBe(172);
  });

  it('handles death correctly', () => {
    const ent = system.spawn();
    SP_monster_supertank(ent, context);

    ent.die!(ent, system.world, system.world, 1600, { x: 0, y: 0, z: 0 });

    expect(ent.deadflag).toBe(DeadFlag.Dead);
    expect(ent.solid).toBe(Solid.Not);
    // Death: 98
    expect(ent.monsterinfo.current_move?.firstframe).toBe(98);
  });

  it('selects attacks correctly', () => {
    const ent = system.spawn();
    SP_monster_supertank(ent, context);

    const enemy = system.spawn();
    enemy.origin = { x: 100, y: 0, z: 0 };
    enemy.health = 100;
    ent.enemy = enemy;

    // Use spy to force random outcomes if needed, or rely on internal logic
    // Range 100 is close -> Chaingun (Attack 1: 0)
    // Random must be > 0.3 for normal logic, but we forced timestamp/logic in implementation
    // Chaingun is default close range unless random < 0.3 (rocket)

    // Force Math.random to return 0.5 (Chaingun path for close range)
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    ent.monsterinfo.attack!(ent);

    // Should be Chaingun (Attack 1)
    expect(ent.monsterinfo.current_move?.firstframe).toBe(0);
  });

  it('selects rocket attack at range', () => {
    const ent = system.spawn();
    SP_monster_supertank(ent, context);

    const enemy = system.spawn();
    enemy.origin = { x: 1000, y: 0, z: 0 }; // Far
    enemy.health = 100;
    ent.enemy = enemy;

    // Force random to prefer Rocket (Attack 2: 20) over Grenade
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    ent.monsterinfo.attack!(ent);

    // Should be Rocket (Attack 2)
    expect(ent.monsterinfo.current_move?.firstframe).toBe(20);
  });
});
