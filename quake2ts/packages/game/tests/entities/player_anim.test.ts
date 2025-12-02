
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P_PlayerThink, player_die, player_pain } from '../../src/entities/player.js';
import { Entity } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { DeadFlag } from '../../src/entities/entity.js';
import {
    FRAME_run1, FRAME_run6,
    FRAME_stand01, FRAME_stand40,
    ANIM_BASIC, ANIM_DEATH, ANIM_PAIN, ANIM_ATTACK
} from '../../src/entities/player_anim.js';

describe('Player Animation System', () => {
  let entity: Entity;
  let sys: EntitySystem;

  beforeEach(() => {
    sys = {
      timeSeconds: 100,
      sound: vi.fn(),
      scheduleThink: vi.fn(),
    } as unknown as EntitySystem;

    entity = {
      client: {
        inventory: {},
        weaponStates: {},
        buttons: 0,
        anim_priority: ANIM_BASIC,
        anim_end: 0,
      },
      velocity: { x: 0, y: 0, z: 0 },
      frame: 0,
      deadflag: DeadFlag.Alive,
    } as unknown as Entity;
  });

  it('should play stand animation when idle', () => {
    entity.velocity = { x: 0, y: 0, z: 0 };
    entity.frame = 0;

    // Force initialization condition
    entity.client!.anim_end = 0; // Not FRAME_stand40 (39)

    P_PlayerThink(entity, sys);

    expect(entity.frame).toBe(FRAME_stand01);
    expect(entity.client!.anim_end).toBe(FRAME_stand40);
    expect(entity.client!.anim_priority).toBe(ANIM_BASIC);
  });

  it('should play run animation when moving', () => {
    entity.velocity = { x: 100, y: 0, z: 0 };

    P_PlayerThink(entity, sys);

    expect(entity.frame).toBe(FRAME_run1);
    expect(entity.client!.anim_end).toBe(FRAME_run6);
  });

  it('should not override attack animation with movement', () => {
    entity.client!.anim_priority = ANIM_ATTACK;
    entity.velocity = { x: 100, y: 0, z: 0 };
    entity.frame = 100; // Some attack frame
    entity.client!.anim_end = 110;

    P_PlayerThink(entity, sys);

    // Should NOT change to run frame, but continue attack animation
    expect(entity.frame).not.toBe(FRAME_run1);
    expect(entity.frame).toBe(101); // Incremented
  });

  it('should handle reverse animation', () => {
    // Setup reverse animation (start > end)
    // Must use higher priority than BASIC to avoid reset logic
    entity.client!.anim_priority = ANIM_ATTACK;
    entity.frame = 20;
    entity.client!.anim_end = 10;

    P_PlayerThink(entity, sys);

    expect(entity.frame).toBe(19); // Should decrement
  });

  it('should handle pain animation priority', () => {
      player_pain(entity, 10);
      expect(entity.client!.anim_priority).toBe(ANIM_PAIN);

      // Attempt movement update
      entity.velocity = { x: 100, y: 0, z: 0 };
      P_PlayerThink(entity, sys);

      // Should stick to pain
      expect(entity.frame).not.toBe(FRAME_run1);
  });
});
