import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerNoise, PNOISE_WEAPON, PNOISE_SELF } from '../../src/ai/noise.js';
import { EntitySystem } from '../../src/entities/system.js';
import { Entity } from '../../src/entities/entity.js';
import { TargetAwarenessState } from '../../src/ai/targeting.js';
import type { GameEngine } from '../../src/index.js';

describe('PlayerNoise', () => {
  let context: EntitySystem;
  let awareness: TargetAwarenessState;
  let mockEngine: GameEngine;
  let player: Entity;
  let other: Entity;

  beforeEach(() => {
    mockEngine = {
        trace: vi.fn(),
    };
    context = new EntitySystem(mockEngine);
    context.beginFrame(10);
    awareness = context.targetAwareness;
    player = context.spawn();
    player.classname = 'player';
    other = context.spawn();
    other.classname = 'other';
  });

  it('updates soundEntity when noise type is WEAPON', () => {
    PlayerNoise(player, player.origin, PNOISE_WEAPON, context);

    expect(awareness.soundEntity).toBe(player);
    expect(awareness.soundEntityFrame).toBe(awareness.frameNumber);
  });

  it('updates sound2Entity when a new noise occurs', () => {
    // First noise
    PlayerNoise(other, other.origin, PNOISE_WEAPON, context);
    expect(awareness.soundEntity).toBe(other);

    // Second noise from player
    PlayerNoise(player, player.origin, PNOISE_WEAPON, context);

    // Previous soundEntity should move to sound2Entity
    expect(awareness.sound2Entity).toBe(other);
    expect(awareness.sound2EntityFrame).toBe(awareness.frameNumber);
    expect(awareness.soundEntity).toBe(player);
    expect(awareness.soundEntityFrame).toBe(awareness.frameNumber);
  });

  it('updates sightClient when noise type is SELF', () => {
    PlayerNoise(player, player.origin, PNOISE_SELF, context);

    expect(awareness.sightClient).toBe(player);
  });

  it('updates sightEntityFrame if sightEntity makes PNOISE_SELF', () => {
      awareness.sightEntity = player;
      awareness.sightEntityFrame = 0;

      PlayerNoise(player, player.origin, PNOISE_SELF, context);

      expect(awareness.sightEntityFrame).toBe(awareness.frameNumber);
  });
});
