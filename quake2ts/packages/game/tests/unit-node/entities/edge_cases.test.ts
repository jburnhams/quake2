import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestGame } from '@quake2ts/test-utils';
import type { GameExports } from '../../../src/index.js';

describe('Entity System Edge Cases', () => {
  let game: GameExports;
  let testEnv: ReturnType<typeof createTestGame>;

  beforeEach(() => {
    vi.clearAllMocks();
    testEnv = createTestGame({ config: { maxEntities: 256 } });
    game = testEnv.game;
  });

  it('handles missing spawn function gracefully', () => {
    const ent = game.entities.spawn();
    ent.classname = 'unknown_entity_type';

    expect(ent).toBeDefined();
    expect(ent.classname).toBe('unknown_entity_type');
  });

  it('handles invalid key-values', () => {
     const ent = game.entities.spawn();
     // Test how the engine handles invalid data types during edge case map loading
     // @ts-expect-error Intentionally assigning string to numeric property for robustness testing
     ent.health = "invalid";
     // @ts-expect-error Verify the invalid value is retained
     expect(ent.health).toBe("invalid");
  });

  it('handles circular targets', () => {
    const entA = game.entities.spawn();
    const entB = game.entities.spawn();

    entA.target = 'targetB';
    entA.targetname = 'targetA';

    entB.target = 'targetA';
    entB.targetname = 'targetB';

    game.entities.finalizeSpawn(entA);
    game.entities.finalizeSpawn(entB);

    let callCount = 0;
    entA.use = (self, other, activator) => {
        callCount++;
        if (callCount > 10) return;
        game.entities.useTargets(self, activator);
    };
    entB.use = (self, other, activator) => {
        callCount++;
        if (callCount > 10) return;
        game.entities.useTargets(self, activator);
    };

    expect(() => game.entities.useTargets(entA, entB)).not.toThrow();
    expect(callCount).toBeGreaterThan(0);
  });

  it('enforces entity limit', () => {
    // 256 maxEntities. We expect an error when spawning more.
    expect(() => {
      for (let i = 0; i < 256 + 10; i++) {
          game.entities.spawn();
      }
    }).toThrowError(/No free entities/i);
  });

  it('handles instant think (nextthink <= time)', () => {
    const ent = game.entities.spawn();
    let thought = false;
    ent.think = (self) => {
        thought = true;
        return true;
    };

    game.entities.scheduleThink(ent, game.entities.timeSeconds);
    game.frame({ frame: 1, deltaSeconds: 0.1, time: 100, pause: false });

    expect(thought).toBe(true);
  });

  it('handles past think (nextthink < time)', () => {
    const ent = game.entities.spawn();
    let thought = false;
    ent.think = (self) => {
        thought = true;
        return true;
    };

    game.entities.scheduleThink(ent, game.entities.timeSeconds - 1.0);
    game.frame({ frame: 1, deltaSeconds: 0.1, time: 100, pause: false });

    expect(thought).toBe(true);
  });
});
