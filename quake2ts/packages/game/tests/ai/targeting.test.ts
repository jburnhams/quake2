
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AI_GetSightClient, findTarget, TargetAwarenessState } from '../../src/ai/targeting.js';
import type { Entity } from '../../src/entities/entity.js';
import type { EntitySystem } from '../../src/entities/system.js';
import { AIFlags, FL_NOTARGET } from '../../src/ai/constants.js';

describe('targeting', () => {
  let monster: Entity;
  let player: Entity;
  let context: EntitySystem;
  let level: TargetAwarenessState;

  beforeEach(() => {
    monster = {
      origin: { x: 0, y: 0, z: 0 },
      angles: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      monsterinfo: {
        aiflags: 0,
      },
      classname: 'monster_soldier',
      inUse: true,
      health: 100,
      flags: 0,
      viewheight: 22,
    } as any;

    player = {
      origin: { x: 100, y: 0, z: 0 }, // In front
      angles: { x: 0, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      classname: 'player',
      inUse: true,
      health: 100,
      flags: 0,
      client: {}, // Marks as client
      light_level: 128,
    } as any;

    context = {
      trace: vi.fn().mockReturnValue({ fraction: 1.0, ent: player }),
      forEachEntity: vi.fn(),
      maxClients: 1,
      entities: [null, player], // g_edicts style, index 1 is player
    } as any;

    level = {
      timeSeconds: 10,
      frameNumber: 100,
      sightEntity: null,
      sightEntityFrame: 0,
      soundEntity: null,
      soundEntityFrame: 0,
      sound2Entity: null,
      sound2EntityFrame: 0,
      sightClient: null,
    };
  });

  describe('AI_GetSightClient', () => {
    it('should return null if monster has NoStep flag', () => {
      monster.monsterinfo.aiflags |= AIFlags.NoStep;
      expect(AI_GetSightClient(monster, context, context.trace)).toBeNull();
    });

    it('should return null if player is dead or not in use', () => {
      player.health = 0;
      expect(AI_GetSightClient(monster, context, context.trace)).toBeNull();

      player.health = 100;
      player.inUse = false;
      expect(AI_GetSightClient(monster, context, context.trace)).toBeNull();
    });

    it('should return null if player has FL_NOTARGET', () => {
      player.flags |= FL_NOTARGET;
      expect(AI_GetSightClient(monster, context, context.trace)).toBeNull();
    });

    it('should return player if visible', () => {
      // visible returns true by default mock of trace if line of sight is clear
      expect(AI_GetSightClient(monster, context, context.trace)).toBe(player);
    });

    it('should return null if not visible', () => {
      context.trace = vi.fn().mockReturnValue({ fraction: 0.5, ent: null }); // Blocked
      expect(AI_GetSightClient(monster, context, context.trace)).toBeNull();
    });
  });
});
