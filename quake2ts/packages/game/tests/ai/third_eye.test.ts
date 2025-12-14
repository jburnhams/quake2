import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, EntityFlags } from '../../src/entities/entity.js';
import { findTarget } from '../../src/ai/targeting.js';
import { AIFlags } from '../../src/ai/constants.js';

describe('AI Third Eye Detection', () => {
  let monster: Entity;
  let enemy: Entity;
  let context: any;

  beforeEach(() => {
    monster = {
      classname: 'monster_soldier',
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      viewheight: 22,
      enemy: null,
      monsterinfo: {
        aiflags: 0,
        sight: vi.fn(),
        last_sighting: { x: 0, y: 0, z: 0 },
      },
      angles: { x: 0, y: 0, z: 0 },
      ideal_yaw: 0,
    } as any;

    enemy = {
      classname: 'player',
      origin: { x: 200, y: 0, z: 0 }, // Nearby
      viewheight: 22,
      flags: 0,
      light_level: 128,
      inUse: true,
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      velocity: { x: 0, y: 0, z: 0 },
    } as any;

    context = {
      trace: vi.fn(),
      timeSeconds: 10,
      targetAwareness: {
        timeSeconds: 10,
        frameNumber: 100,
        sightEntity: null,
        sightEntityFrame: 0,
        soundEntity: null,
        soundEntityFrame: 0,
        sound2Entity: null,
        sound2EntityFrame: 0,
        sightClient: null,
      },
      maxClients: 1,
      entities: [null, enemy],
      skill: 1,
    };
  });

  it('should not detect hidden enemy without ThirdEye', () => {
    // Hidden
    context.targetAwareness.sightClient = enemy; // Potential candidate

    // Trace returns blocked
    context.trace.mockReturnValue({ fraction: 0.5, ent: null });

    const result = findTarget(monster, context.targetAwareness, context, context.trace);
    expect(result).toBe(false);
  });

  it('should detect hidden enemy with ThirdEye flag', () => {
    monster.monsterinfo.aiflags |= AIFlags.ThirdEye;

    // Hidden
    context.targetAwareness.sightClient = enemy; // Potential candidate

    // Trace returns blocked
    context.trace.mockReturnValue({ fraction: 0.5, ent: null });

    const result = findTarget(monster, context.targetAwareness, context, context.trace);
    expect(result).toBe(true);
    expect(monster.enemy).toBe(enemy);
  });

  it('should clear ThirdEye flag after successfully finding target', () => {
     monster.monsterinfo.aiflags |= AIFlags.ThirdEye;
     context.targetAwareness.sightClient = enemy;
     context.trace.mockReturnValue({ fraction: 0.5, ent: null });

     findTarget(monster, context.targetAwareness, context, context.trace);

     // The flag should be cleared in foundTarget (called by findTarget)
     expect((monster.monsterinfo.aiflags & AIFlags.ThirdEye)).toBe(0);
  });
});
