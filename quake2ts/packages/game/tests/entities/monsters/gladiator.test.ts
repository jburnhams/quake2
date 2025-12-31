import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_gladiator } from '../../../src/entities/monsters/gladiator.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { SpawnContext } from '../../../src/entities/spawn.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { createMonsterEntityFactory } from '@quake2ts/test-utils/game/factories';

describe('monster_gladiator', () => {
  let system: EntitySystem;
  let context: SpawnContext;
  let ent: Entity;

  beforeEach(() => {
    const testCtx = createTestContext();
    system = testCtx.entities;
    context = testCtx;

    ent = createMonsterEntityFactory('monster_gladiator', {
        health: 400,
        max_health: 400,
        mass: 400,
        solid: Solid.BoundingBox,
        movetype: MoveType.Step
    });
  });

  it('spawns with correct properties', () => {
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
    SP_monster_gladiator(ent, context);

    expect(ent.monsterinfo.current_move).toBeDefined();
    expect(ent.monsterinfo.current_move?.firstframe).toBe(0);
  });

  it('handles pain correctly', () => {
    SP_monster_gladiator(ent, context);
    ent.health = 100;

    ent.pain!(ent, system.world, 0, 10);
    expect(ent.monsterinfo.current_move?.firstframe).toBe(112);
  });

  it('handles death correctly', () => {
    SP_monster_gladiator(ent, context);

    ent.die!(ent, system.world, system.world, 500, { x: 0, y: 0, z: 0 });

    expect(ent.deadflag).toBe(DeadFlag.Dead);
    expect(ent.solid).toBe(Solid.Not);
    expect(ent.monsterinfo.current_move?.firstframe).toBe(118);
  });
});
