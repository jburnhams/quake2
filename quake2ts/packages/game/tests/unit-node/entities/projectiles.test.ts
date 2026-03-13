import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGrenade } from '../../../src/entities/projectiles.js';
import { MoveType } from '../../../src/entities/entity.js';
import { ZERO_VEC3 } from '@quake2ts/shared';
import { createTestContext, createPlayerEntityFactory, TestContext } from '@quake2ts/test-utils';
import { Entity } from '../../../src/entities/entity.js';

describe('createGrenade', () => {
  let ctx: TestContext;
  let owner: Entity;

  beforeEach(() => {
    ctx = createTestContext();
    owner = createPlayerEntityFactory({
      origin: { x: 0, y: 0, z: 0 },
    });
    ctx.entities.timeSeconds = 10;
  });

  it('should create a grenade with correct default timer', () => {
    const dir = { x: 1, y: 0, z: 0 };
    createGrenade(ctx.entities, owner, owner.origin, dir, 100, 500);

    const grenade = ctx.entities.findByClassname('grenade')[0];
    expect(grenade).toBeDefined();
    expect(grenade.classname).toBe('grenade');
    expect(ctx.entities.scheduleThink).toHaveBeenCalledWith(grenade, 12.5); // 10 + 2.5
  });

  it('should create a grenade with custom timer', () => {
    const dir = { x: 1, y: 0, z: 0 };
    createGrenade(ctx.entities, owner, owner.origin, dir, 100, 500, 1.0);

    const grenade = ctx.entities.findByClassname('grenade')[0];
    expect(ctx.entities.scheduleThink).toHaveBeenCalledWith(grenade, 11.0); // 10 + 1.0
  });

  it('should have bounce logic', () => {
      const dir = { x: 1, y: 0, z: 0 };
      createGrenade(ctx.entities, owner, owner.origin, dir, 100, 500);
      const grenade = ctx.entities.findByClassname('grenade')[0];

      expect(grenade.movetype).toBe(MoveType.Bounce);
      expect(grenade.touch).toBeDefined();
  });

  it('should play bounce sound on touch if not on ground', () => {
      const dir = { x: 1, y: 0, z: 0 };
      createGrenade(ctx.entities, owner, owner.origin, dir, 100, 500);
      const grenade = ctx.entities.findByClassname('grenade')[0];

      grenade.groundentity = undefined;
      grenade.touch?.(grenade, null, null, null);

      expect(ctx.entities.sound).toHaveBeenCalledWith(grenade, 0, 'weapons/grenlb1b.wav', 1, 1, 0);
  });
});
