import { describe, it, expect, beforeEach } from 'vitest';
import { SP_monster_flipper } from '../../../../src/entities/monsters/flipper.js';
import { MoveType, Solid, DeadFlag } from '../../../../src/entities/entity.js';
import { createTestContext, TestContext } from '@quake2ts/test-utils';

describe('monster_flipper', () => {
  let context: TestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  it('spawns with correct properties', () => {
    const ent = context.entities.spawn();
    SP_monster_flipper(ent, context);

    expect(ent.classname).toBe('monster_flipper');
    expect(ent.model).toBe('models/monsters/flipper/tris.md2');
    expect(ent.health).toBe(50);
    expect(ent.max_health).toBe(50);
    expect(ent.mass).toBe(100);
    expect(ent.solid).toBe(Solid.BoundingBox);
    expect(ent.movetype).toBe(MoveType.Step);
  });

  it('enters stand state after spawn', () => {
    const ent = context.entities.spawn();
    SP_monster_flipper(ent, context);

    expect(ent.monsterinfo.current_move).toBeDefined();
    expect(ent.monsterinfo.current_move?.firstframe).toBe(41);
  });

  it('handles pain correctly', () => {
    const ent = context.entities.spawn();
    SP_monster_flipper(ent, context);

    // Force pain debounce to pass
    ent.pain_debounce_time = 0;

    ent.pain!(ent, context.entities.world, 0, 10);
    const frame = ent.monsterinfo.current_move?.firstframe;
    const painFrames = [99, 94]; // pain1, pain2
    expect(painFrames).toContain(frame);
  });

  it('handles death correctly', () => {
    const ent = context.entities.spawn();
    SP_monster_flipper(ent, context);

    ent.die!(ent, context.entities.world, context.entities.world, 500, { x: 0, y: 0, z: 0 });

    expect(ent.deadflag).toBe(DeadFlag.Dead);
    // Death animation
    expect(ent.monsterinfo.current_move?.firstframe).toBe(104);
  });
});
