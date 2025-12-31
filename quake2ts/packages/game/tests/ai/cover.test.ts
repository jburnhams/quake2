import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, EntityFlags } from '../../src/entities/entity.js';
import { findCover } from '../../src/ai/targeting.js';
import { createMonsterEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils/game/factories';
import { createEntityFactory } from '@quake2ts/test-utils';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { EntitySystem } from '../../src/entities/system.js';

describe('AI Cover Seeking', () => {
  let monster: Entity;
  let enemy: Entity;
  let coverSpot1: Entity;
  let coverSpot2: Entity;
  let context: EntitySystem;

  beforeEach(() => {
    const testCtx = createTestContext();
    context = testCtx.entities;

    // Use factory for monster
    const monsterData = createMonsterEntityFactory('monster_soldier', {
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      viewheight: 22,
      inUse: true
    });
    monster = context.spawn();
    Object.assign(monster, monsterData);

    // Mock AI functions required for this test
    monster.monsterinfo = {
        ...monster.monsterinfo,
        aiflags: 0,
        run: vi.fn(),
    } as any;

    // Use factory for player enemy
    const enemyData = createPlayerEntityFactory({
      origin: { x: 500, y: 0, z: 0 },
      viewheight: 22,
      flags: 0,
      inUse: true
    });
    enemy = context.spawn();
    Object.assign(enemy, enemyData);

    monster.enemy = enemy;

    // Create cover spots using generic factory
    const spot1Data = createEntityFactory({
      classname: 'point_combat',
      origin: { x: 0, y: 100, z: 0 },
      viewheight: 0,
      inUse: true
    });
    coverSpot1 = context.spawn();
    Object.assign(coverSpot1, spot1Data);
    coverSpot1.owner = null;

    const spot2Data = createEntityFactory({
      classname: 'point_combat',
      origin: { x: 0, y: -100, z: 0 },
      viewheight: 0,
      inUse: true
    });
    coverSpot2 = context.spawn();
    Object.assign(coverSpot2, spot2Data);
    coverSpot2.owner = null;

    // Mock findByClassname to return our test cover spots
    // This allows findCover to iterate over potential cover locations
    (context as any).findByClassname = vi.fn().mockReturnValue([coverSpot1, coverSpot2]);
  });

  it('should return false if no enemy', () => {
    monster.enemy = null;
    const result = findCover(monster, context);
    expect(result).toBe(false);
  });

  it('should find a valid cover spot and move towards it', () => {
    const trace = vi.fn();
    context.trace = trace as any;

    trace.mockImplementation((start, mins, maxs, end, passEntity, contentMask) => {
        // Trace logic: check visibility between spot and enemy, or monster and spot

        // Check if tracing from coverSpot1 to enemy (visibility check)
        if (Math.abs(start.x - coverSpot1.origin.x) < 1 && Math.abs(start.y - coverSpot1.origin.y) < 1 &&
            Math.abs(end.x - enemy.origin.x) < 1 && Math.abs(end.y - enemy.origin.y) < 1) {
             return { fraction: 0.5, ent: null }; // Blocked -> Hidden from enemy -> Good cover
        }

        // Check if tracing from monster to coverSpot1 (reachability check)
        if (Math.abs(start.x - monster.origin.x) < 1 && Math.abs(start.y - monster.origin.y) < 1 &&
            Math.abs(end.x - coverSpot1.origin.x) < 1 && Math.abs(end.y - coverSpot1.origin.y) < 1) {
             return { fraction: 1.0, ent: null }; // Clear path -> Reachable
        }

        // Default: everything else is visible/reachable
        return { fraction: 1.0, ent: null };
    });

    const result = findCover(monster, context);

    expect(result).toBe(true);
    expect(monster.goalentity).toBe(coverSpot1);
    expect(monster.movetarget).toBe(coverSpot1);
    expect(monster.monsterinfo.run).toHaveBeenCalled();
  });

  it('should ignore occupied cover spots', () => {
    const other = context.spawn(); // occupy with valid entity
    coverSpot1.owner = other;

    // Mock trace such that coverSpot2 is the valid choice
    const trace = vi.fn().mockImplementation((start, mins, maxs, end) => {
        // Check coverSpot2 visibility to enemy
         if (Math.abs(start.x - coverSpot2.origin.x) < 1 && Math.abs(start.y - coverSpot2.origin.y) < 1 &&
            Math.abs(end.x - enemy.origin.x) < 1 && Math.abs(end.y - enemy.origin.y) < 1) {
             return { fraction: 0.5, ent: null }; // Blocked -> Good cover
        }

        // Check monster to coverSpot2 reachability
        if (Math.abs(start.x - monster.origin.x) < 1 && Math.abs(start.y - monster.origin.y) < 1 &&
            Math.abs(end.x - coverSpot2.origin.x) < 1 && Math.abs(end.y - coverSpot2.origin.y) < 1) {
             return { fraction: 1.0, ent: null }; // Reachable
        }

        return { fraction: 1.0 };
    });
    context.trace = trace as any;

    const result = findCover(monster, context);

    expect(result).toBe(true);
    expect(monster.goalentity).toBe(coverSpot2);
  });
});
