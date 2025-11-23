import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_berserk } from '../../../src/entities/monsters/berserk.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createGame } from '../../../src/index.js';
import { SpawnContext } from '../../../src/entities/spawn.js';

describe('monster_berserk', () => {
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
    system = (gameExports as any).entities; // Access internal entities for testing

    context = {
      keyValues: {},
      entities: system,
      warn: vi.fn(),
      free: vi.fn(),
    };
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    SP_monster_berserk(ent, context);

    expect(ent.classname).toBe('monster_berserk');
    expect(ent.model).toBe('models/monsters/berserk/tris.md2');
    expect(ent.health).toBe(240);
    expect(ent.max_health).toBe(240);
    expect(ent.mass).toBe(250);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
    expect(ent.takedamage).toBe(true);
  });

  it('enters stand state after spawn', () => {
    const ent = system.spawn();
    SP_monster_berserk(ent, context);

    // Check if monsterinfo is initialized
    expect(ent.monsterinfo.stand).toBeDefined();
    expect(ent.monsterinfo.walk).toBeDefined();
    expect(ent.monsterinfo.run).toBeDefined();
    expect(ent.monsterinfo.attack).toBeDefined();

    // Should be in stand move
    expect(ent.monsterinfo.current_move).toBeDefined();
    expect(ent.monsterinfo.current_move?.firstframe).toBe(0);
  });

  it('handles pain correctly', () => {
    const ent = system.spawn();
    SP_monster_berserk(ent, context);
    ent.health = 100; // Below half health (240/2 = 120)

    expect(ent.pain).toBeDefined();
    ent.pain!(ent, system.world, 0, 10);

    // Should transition to pain frames
    expect(ent.monsterinfo.current_move?.firstframe).toBe(116);
  });

  it('handles death correctly', () => {
    const ent = system.spawn();
    SP_monster_berserk(ent, context);

    expect(ent.die).toBeDefined();
    ent.die!(ent, system.world, system.world, 250, { x: 0, y: 0, z: 0 });

    expect(ent.deadflag).toBe(DeadFlag.Dead);
    expect(ent.solid).toBe(Solid.Not);
    // Should transition to death frames
    expect(ent.monsterinfo.current_move?.firstframe).toBe(122);
  });

  it('gibs when health is very low', () => {
      const ent = system.spawn();
      SP_monster_berserk(ent, context);
      ent.health = -50;

      const freeSpy = vi.spyOn(context.entities, 'free');
      ent.die!(ent, system.world, system.world, 50, { x: 0, y: 0, z: 0 });

      expect(freeSpy).toHaveBeenCalledWith(ent);
  });
});
