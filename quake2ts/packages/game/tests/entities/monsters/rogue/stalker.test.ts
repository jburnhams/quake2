import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_stalker } from '../../../../src/entities/monsters/rogue/stalker.js';
import { createTestContext } from '../../../test-helpers.js';
import { Entity, MoveType, Solid, DeadFlag } from '../../../../src/entities/entity.js';

describe('monster_stalker', () => {
  let context: any;
  let entity: Entity;

  beforeEach(() => {
    context = createTestContext();
    context.health_multiplier = 1.0;
    entity = context.entities.spawn();
    vi.clearAllMocks();
  });

  it('should spawn with correct initial state', () => {
    SP_monster_stalker(entity, context);

    expect(entity.health).toBe(250);
    expect(entity.max_health).toBe(250);
    expect(entity.mass).toBe(250);
    expect(entity.movetype).toBe(MoveType.Step);
    expect(entity.solid).toBe(Solid.BoundingBox);
    expect(entity.mins).toEqual({ x: -28, y: -28, z: -18 });
    expect(entity.maxs).toEqual({ x: 28, y: 28, z: 18 });
  });

  it('should start on ceiling if spawnflag is set', () => {
    const SPAWNFLAG_STALKER_ONROOF = 8;
    entity.spawnflags = SPAWNFLAG_STALKER_ONROOF;

    SP_monster_stalker(entity, context);

    expect(entity.angles.z).toBe(180);
  });

  it('should have pain and die callbacks', () => {
    SP_monster_stalker(entity, context);
    expect(entity.pain).toBeDefined();
    expect(entity.die).toBeDefined();
  });

  it('should set skin based on health', () => {
    SP_monster_stalker(entity, context);
    expect(entity.monsterinfo.setskin).toBeDefined();

    entity.health = 10;
    entity.monsterinfo.setskin!(entity);
    expect(entity.skin).toBe(1); // Damaged skin

    entity.health = 250;
    entity.monsterinfo.setskin!(entity);
    expect(entity.skin).toBe(0); // Normal skin
  });
});
