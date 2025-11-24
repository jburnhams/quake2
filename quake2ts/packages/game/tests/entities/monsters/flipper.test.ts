import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_flipper } from '../../../src/entities/monsters/flipper.js';
import { Entity, MoveType, Solid, DeadFlag, EntityFlags } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createGame } from '../../../src/index.js';
import { SpawnContext } from '../../../src/entities/spawn.js';

describe('monster_flipper', () => {
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

    // Spy on free directly on the system instance created by createGame
    vi.spyOn(system, 'free');

    context = {
      keyValues: {},
      entities: system,
      warn: vi.fn(),
      free: system.free, // Pass the spy
    };
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    SP_monster_flipper(ent, context);

    expect(ent.classname).toBe('monster_flipper');
    expect(ent.model).toBe('models/monsters/flipper/tris.md2');
    expect(ent.health).toBe(50);
    expect(ent.max_health).toBe(50);
    expect(ent.mass).toBe(100);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Fly);
    expect(ent.flags & EntityFlags.Swim).toBe(EntityFlags.Swim);
  });

  it('enters stand state after spawn', () => {
    const ent = system.spawn();
    SP_monster_flipper(ent, context);

    // Stand frame 41
    expect(ent.monsterinfo.current_move).toBeDefined();
    expect(ent.monsterinfo.current_move?.firstframe).toBe(41);
  });

  it('handles pain correctly', () => {
    const ent = system.spawn();
    SP_monster_flipper(ent, context);
    ent.health = 20; // Low health

    // Pain 1: 99
    // Pain 2: 94
    // Mock random
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // Should pick pain2 (>= 0.5)

    ent.pain!(ent, system.world, 0, 10);
    expect(ent.monsterinfo.current_move?.firstframe).toBe(94);
  });

  it('handles death correctly', () => {
    const ent = system.spawn();
    SP_monster_flipper(ent, context);

    ent.die!(ent, system.world, system.world, 60, { x: 0, y: 0, z: 0 });

    expect(ent.deadflag).toBe(DeadFlag.Dead);
    // Death: 104
    expect(ent.monsterinfo.current_move?.firstframe).toBe(104);
  });

  it('handles gibbing correctly', () => {
    const ent = system.spawn();
    SP_monster_flipper(ent, context);

    // Gib health is -30
    // Set health to -40 (simulating post-damage state)
    ent.health = -40;
    ent.die!(ent, system.world, system.world, 50, { x: 0, y: 0, z: 0 });

    expect(system.free).toHaveBeenCalledWith(ent);
  });
});
