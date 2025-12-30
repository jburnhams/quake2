import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SP_monster_chick } from '../../../src/entities/monsters/chick.js';
import { MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { createTestContext, createMonsterEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';

describe('monster_chick', () => {
  let context: any;

  beforeEach(() => {
    context = createTestContext();
  });

  it('spawns with correct properties', () => {
    const ent = createMonsterEntityFactory('monster_chick');
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
    const ent = createMonsterEntityFactory('monster_chick');
    SP_monster_chick(ent, context);

    expect(ent.monsterinfo.current_move).toBeDefined();
    expect(ent.monsterinfo.current_move?.firstframe).toBe(101);
  });

  it('handles pain correctly', () => {
    const ent = createMonsterEntityFactory('monster_chick');
    SP_monster_chick(ent, context);

    // Force pain debounce to pass
    ent.pain_debounce_time = 0;

    ent.pain!(ent, ent, 0, 10);
    const frame = ent.monsterinfo.current_move?.firstframe;
    const painFrames = [90, 95, 100]; // pain1, pain2, pain3
    expect(painFrames).toContain(frame);
  });

  it('handles death correctly', () => {
    const ent = createMonsterEntityFactory('monster_chick');
    SP_monster_chick(ent, context);
    const killer = createPlayerEntityFactory();

    ent.die!(ent, killer, killer, 500, { x: 0, y: 0, z: 0 });

    expect(ent.deadflag).toBe(DeadFlag.Dead);
    // Death animation frames
    const frame = ent.monsterinfo.current_move?.firstframe;
    const deathFrames = [48, 60]; // death1, death2
    expect(deathFrames).toContain(frame);
  });
});
