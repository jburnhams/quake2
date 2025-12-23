import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_chick } from '../../../src/entities/monsters/chick.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { createGame } from '../../../src/index.js';
import { SpawnContext } from '../../../src/entities/spawn.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

describe('monster_chick', () => {
  let system: EntitySystem;
  let context: SpawnContext;

  beforeEach(() => {
    // Mock game engine and imports
    const { imports, engine } = createGameImportsAndEngine();

    const gameExports = createGame(imports, engine as any, { gravity: { x: 0, y: 0, z: -800 }, skill: 1 });
    system = (gameExports as any).entities;

    context = {
      keyValues: {},
      entities: system,
      health_multiplier: 1,
      warn: vi.fn(),
      free: vi.fn(),
    };
  });

  it('spawns with correct properties', () => {
    const ent = system.spawn();
    SP_monster_chick(ent, context);

    expect(ent.classname).toBe('monster_chick');
    expect(ent.model).toBe('models/monsters/bitch/tris.md2');
    expect(ent.health).toBe(175);
    expect(ent.max_health).toBe(175);
    expect(ent.mass).toBe(200);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
  });

  it('enters stand state after spawn', () => {
    const ent = system.spawn();
    SP_monster_chick(ent, context);

    expect(ent.monsterinfo.current_move).toBeDefined();
    expect(ent.monsterinfo.current_move?.firstframe).toBe(101);
  });

  it('handles pain correctly', () => {
    const ent = system.spawn();
    SP_monster_chick(ent, context);

    // Force pain debounce to pass
    ent.pain_debounce_time = 0;

    ent.pain!(ent, system.world, 0, 10);
    const frame = ent.monsterinfo.current_move?.firstframe;
    const painFrames = [90, 95, 100]; // pain1, pain2, pain3
    expect(painFrames).toContain(frame);
  });

  it('handles death correctly', () => {
    const ent = system.spawn();
    SP_monster_chick(ent, context);

    ent.die!(ent, system.world, system.world, 500, { x: 0, y: 0, z: 0 });

    expect(ent.deadflag).toBe(DeadFlag.Dead);
    // Death animation frames
    const frame = ent.monsterinfo.current_move?.firstframe;
    const deathFrames = [48, 60]; // death1, death2
    expect(deathFrames).toContain(frame);
  });
});
