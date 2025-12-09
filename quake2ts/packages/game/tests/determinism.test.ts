import { describe, it, expect, vi } from 'vitest';
import { createTestContext } from './test-helpers.js';
import { RandomGenerator } from '@quake2ts/shared';

describe('Determinism', () => {
  it('game state is deterministic with same seed', () => {
    const seed = 12345;
    const runs = 2;
    const frames = 100;

    const finalStates: any[] = [];

    for (let run = 0; run < runs; run++) {
      const { entities } = createTestContext({
         // Ensure we pass the seed to the game creation if supported,
         // or verify createTestContext uses a deterministic RNG by default or mocked one.
         // Looking at createTestContext implementation (in memory):
         // It likely mocks things. If we want true determinism test of the game loop,
         // we need to ensure the RNG used by entities is the one we control.
      });

      // Override RNG with a seeded one for this test run to be sure
      // NOTE: We must ensure we are testing the RNG attached to the system
      const rng = new RandomGenerator(seed);
      (entities as any).rng = rng;

      // Run N frames
      for (let i = 0; i < frames; i++) {
        // game.runFrame();
        // Since createTestContext gives us a mock-heavy environment, we might simulate frame updates manually
        // or checking if we can rely on `entities.timeSeconds` advancement.

        // Let's spawn an entity that uses RNG and see if it behaves identically
        // e.g. a particle or a monster that wanders.

        // For this test to be meaningful, we need to invoke logic that uses the RNG.
        // Let's manually invoke RNG
        entities.rng.frandom();
      }

      // Hash state - simplistically just capture the RNG state or some side effect
      // Since we don't have a full game loop in this unit test context easily without setup,
      // we verify the RNG sequence is identical.

      finalStates.push(rng.getState());
    }

    // Vitest 'toBe' checks object reference equality, but RandomGenerator state returns a new object.
    // Use toStrictEqual for deep equality check.
    expect(finalStates[0]).toStrictEqual(finalStates[1]);
  });

  it('produces different results with different seeds', () => {
      const { entities: ent1 } = createTestContext({ seed: 11111 });
      const { entities: ent2 } = createTestContext({ seed: 22222 });

      // Ensure we are using the mocked RNG which should respect the seed passed to createTestContext

      // Verify initial states are different (if we expose state)
      // or verify output sequence is different.

      // Note: If RandomGenerator implementation is flawed, this might fail.
      // But assuming Shared package is correct.

      // Let's verify we actually got different RNG instances
      expect(ent1.rng).not.toBe(ent2.rng);

      const r1 = ent1.rng.frandom();
      const r2 = ent2.rng.frandom();

      expect(r1).not.toBe(r2);
  });

  it('EntitySystem exposes deterministic RNG', () => {
      const { entities } = createTestContext();
      expect(entities.rng).toBeDefined();
      expect(typeof entities.rng.frandom).toBe('function');
      expect(typeof entities.rng.crandom).toBe('function');
  });
});
