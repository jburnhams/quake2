import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity } from '../../src/entities/entity.js';
import { findTarget } from '../../src/ai/targeting.js';
import { AIFlags } from '../../src/ai/constants.js';
import { createMonsterEntityFactory, createPlayerEntityFactory, createTestContext, spawnEntity } from '@quake2ts/test-utils';

describe('AI Third Eye Detection', () => {
  let monster: Entity;
  let enemy: Entity;
  let context: any; // ReturnType<typeof createTestContext>
  let mockContext: any;

  beforeEach(() => {
    context = createTestContext();
    mockContext = context.entities;

    monster = spawnEntity(mockContext, createMonsterEntityFactory('monster_soldier', {
      origin: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      viewheight: 22,
      enemy: null,
      monsterinfo: {
        aiflags: 0,
        sight: vi.fn(),
        last_sighting: { x: 0, y: 0, z: 0 },
      } as any,
      angles: { x: 0, y: 0, z: 0 },
      ideal_yaw: 0,
    }));

    enemy = spawnEntity(mockContext, createPlayerEntityFactory({
      origin: { x: 200, y: 0, z: 0 }, // Nearby
      viewheight: 22,
      light_level: 128,
      inUse: true,
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      velocity: { x: 0, y: 0, z: 0 },
    }));

    // Setup targeting context
    mockContext.timeSeconds = 10;
    mockContext.targetAwareness = {
        timeSeconds: 10,
        frameNumber: 100,
        sightEntity: null,
        sightEntityFrame: 0,
        soundEntity: null,
        soundEntityFrame: 0,
        sound2Entity: null,
        sound2EntityFrame: 0,
        sightClient: null,
        activePlayers: [enemy],
        monsterAlertedByPlayers: vi.fn(),
        soundClient: vi.fn(),
    };
    mockContext.maxClients = 1;
    mockContext.skill = 1;

    // Use trace mock from context
    // traceMock = mockContext.trace;
  });

  it('should not detect hidden enemy without ThirdEye', () => {
    // Hidden
    mockContext.targetAwareness.sightClient = enemy; // Potential candidate

    // Trace returns blocked
    mockContext.trace.mockReturnValue({ fraction: 0.5, ent: null });

    const result = findTarget(monster, mockContext.targetAwareness, mockContext, mockContext.trace);
    expect(result).toBe(false);
  });

  it('should detect hidden enemy with ThirdEye flag', () => {
    monster.monsterinfo!.aiflags |= AIFlags.ThirdEye;

    // Hidden
    mockContext.targetAwareness.sightClient = enemy; // Potential candidate

    // Trace returns blocked
    mockContext.trace.mockReturnValue({ fraction: 0.5, ent: null });

    const result = findTarget(monster, mockContext.targetAwareness, mockContext, mockContext.trace);
    expect(result).toBe(true);
    expect(monster.enemy).toBe(enemy);
  });

  it('should clear ThirdEye flag after successfully finding target', () => {
     monster.monsterinfo!.aiflags |= AIFlags.ThirdEye;
     mockContext.targetAwareness.sightClient = enemy;
     mockContext.trace.mockReturnValue({ fraction: 0.5, ent: null });

     findTarget(monster, mockContext.targetAwareness, mockContext, mockContext.trace);

     // The flag should be cleared in foundTarget (called by findTarget)
     expect((monster.monsterinfo!.aiflags & AIFlags.ThirdEye)).toBe(0);
  });
});
