import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, EntityFlags } from '../../src/entities/entity.js';
import { findCover } from '../../src/ai/targeting.js';
import { AIFlags } from '../../src/ai/constants.js';

describe('AI Cover Seeking', () => {
  let monster: Entity;
  let enemy: Entity;
  let coverSpot1: Entity;
  let coverSpot2: Entity;
  let context: any;

  beforeEach(() => {
    monster = {
      classname: 'monster_soldier',
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      viewheight: 22,
      enemy: null,
      goalentity: null,
      movetarget: null,
      monsterinfo: {
        aiflags: 0,
        run: vi.fn(),
      },
      angles: { x: 0, y: 0, z: 0 },
      ideal_yaw: 0,
    } as any;

    enemy = {
      classname: 'player',
      origin: { x: 500, y: 0, z: 0 },
      viewheight: 22,
      flags: 0,
    } as any;

    monster.enemy = enemy;

    coverSpot1 = {
      classname: 'point_combat',
      origin: { x: 0, y: 100, z: 0 },
      viewheight: 0,
      inUse: true,
      owner: null, // Not occupied
    } as any;

    coverSpot2 = {
      classname: 'point_combat',
      origin: { x: 0, y: -100, z: 0 },
      viewheight: 0,
      inUse: true,
      owner: null,
    } as any;

    context = {
      findByClassname: vi.fn().mockReturnValue([coverSpot1, coverSpot2]),
      trace: vi.fn().mockReturnValue({ fraction: 1.0, ent: null }),
      timeSeconds: 10,
    };
  });

  it('should return false if no enemy', () => {
    monster.enemy = null;
    const result = findCover(monster, context);
    expect(result).toBe(false);
  });

  it('should find a valid cover spot and move towards it', () => {
    const trace = vi.fn();
    context.trace = trace;

    trace.mockImplementation((start, mins, maxs, end, passEntity, contentMask) => {
        // Check "visible(spot, enemy)" call.
        // spot -> enemy.
        // start should be spot.origin (plus viewheight).
        // end should be enemy.origin (plus viewheight).

        // coverSpot1 check
        if (Math.abs(start.x - coverSpot1.origin.x) < 1 && Math.abs(start.y - coverSpot1.origin.y) < 1 &&
            Math.abs(end.x - enemy.origin.x) < 1 && Math.abs(end.y - enemy.origin.y) < 1) {
             return { fraction: 0.5, ent: null }; // Blocked -> Good cover (hidden)
        }

        // Reachability check: visible(self, spot)
        // self -> spot
        if (Math.abs(start.x - monster.origin.x) < 1 && Math.abs(start.y - monster.origin.y) < 1 &&
            Math.abs(end.x - coverSpot1.origin.x) < 1 && Math.abs(end.y - coverSpot1.origin.y) < 1) {
             return { fraction: 1.0, ent: null }; // Reachable
        }

        // Default: everything else is visible (fraction 1)
        // This means coverSpot2 -> enemy IS visible (bad cover)
        return { fraction: 1.0, ent: null };
    });

    const result = findCover(monster, context);

    expect(result).toBe(true);
    expect(monster.goalentity).toBe(coverSpot1);
    expect(monster.movetarget).toBe(coverSpot1);
    expect(monster.monsterinfo.run).toHaveBeenCalled();
  });

  it('should ignore occupied cover spots', () => {
    coverSpot1.owner = { index: 999 } as any; // Occupied

    // mock trace such that coverSpot2 is valid (hidden)
    const trace = vi.fn().mockImplementation((start, mins, maxs, end) => {
        // coverSpot2 -> enemy
         if (Math.abs(start.x - coverSpot2.origin.x) < 1 && Math.abs(start.y - coverSpot2.origin.y) < 1 &&
            Math.abs(end.x - enemy.origin.x) < 1 && Math.abs(end.y - enemy.origin.y) < 1) {
             return { fraction: 0.5, ent: null }; // Blocked -> Good cover
        }

        // Reachability: self -> coverSpot2
        if (Math.abs(start.x - monster.origin.x) < 1 && Math.abs(start.y - monster.origin.y) < 1 &&
            Math.abs(end.x - coverSpot2.origin.x) < 1 && Math.abs(end.y - coverSpot2.origin.y) < 1) {
             return { fraction: 1.0, ent: null };
        }

        return { fraction: 1.0 };
    });
    context.trace = trace;

    const result = findCover(monster, context);

    expect(result).toBe(true);
    expect(monster.goalentity).toBe(coverSpot2);
  });
});
