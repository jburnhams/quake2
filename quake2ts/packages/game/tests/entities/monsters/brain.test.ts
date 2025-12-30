import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SP_monster_brain } from '../../../src/entities/monsters/brain.js';
import { MoveType, Solid, DeadFlag } from '../../../src/entities/entity.js';
import { createTestContext, createMonsterEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';

describe('monster_brain', () => {
  let context: any;

  beforeEach(() => {
    context = createTestContext();
  });

  it('spawns with correct properties', () => {
    const ent = createMonsterEntityFactory('monster_brain');
    SP_monster_brain(ent, context);

    expect(ent.classname).toBe('monster_brain');
    expect(ent.model).toBe('models/monsters/brain/tris.md2');
    expect(ent.health).toBe(300);
    expect(ent.max_health).toBe(300);
    expect(ent.mass).toBe(400);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
  });

  it('enters stand state after spawn', () => {
    const ent = createMonsterEntityFactory('monster_brain');
    SP_monster_brain(ent, context);

    expect(ent.monsterinfo.current_move).toBeDefined();
    expect(ent.monsterinfo.current_move?.firstframe).toBe(162);
  });

  it('handles pain correctly', () => {
    const ent = createMonsterEntityFactory('monster_brain');
    SP_monster_brain(ent, context);

    // Force pain debounce to pass
    ent.pain_debounce_time = 0;

    ent.pain!(ent, ent, 0, 10);
    // Pain can be one of three animations (frames 88, 109, 117)
    // We check that current_move is set to one of the pain moves
    const frame = ent.monsterinfo.current_move?.firstframe;
    const painFrames = [88, 109, 117];
    expect(painFrames).toContain(frame);
  });

  it('handles death correctly', () => {
    const ent = createMonsterEntityFactory('monster_brain');
    SP_monster_brain(ent, context);
    const killer = createPlayerEntityFactory();

    ent.die!(ent, killer, killer, 500, { x: 0, y: 0, z: 0 });

    expect(ent.deadflag).toBe(DeadFlag.Dead);

    // Death can be one of two animations (frames 123, 141)
    const frame = ent.monsterinfo.current_move?.firstframe;
    const deathFrames = [123, 141];
    expect(deathFrames).toContain(frame);
  });
});
