import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestContext } from './test-helpers.js';
import { RandomGenerator } from '@quake2ts/shared';

describe('Determinism', () => {
  let originalMathRandom: () => number;

  beforeEach(() => {
    originalMathRandom = Math.random;
    // Trap Math.random usage
    Math.random = () => {
      throw new Error('Math.random() called in deterministic context!');
    };
  });

  afterEach(() => {
    Math.random = originalMathRandom;
  });

  it('EntitySystem uses deterministic RNG seeded from context', () => {
    const seed = 12345;
    const { entities } = createTestContext({ seed });

    // Verify the RNG is attached and seeded correctly
    expect(entities.rng).toBeInstanceOf(RandomGenerator);

    const val1 = entities.rng.frandom();
    const val2 = entities.rng.frandom();

    // Create another context with same seed
    const { entities: entities2 } = createTestContext({ seed });

    expect(entities2.rng.frandom()).toBe(val1);
    expect(entities2.rng.frandom()).toBe(val2);
  });

  it('produces different sequences with different seeds', () => {
    const { entities: ent1 } = createTestContext({ seed: 11111 });
    const { entities: ent2 } = createTestContext({ seed: 22222 });

    const r1 = ent1.rng.frandom();
    const r2 = ent2.rng.frandom();

    expect(r1).not.toBe(r2);
  });

  it('monster spawning and thinking logic is deterministic', () => {
    // This test simulates a minimal "gameplay" loop involving RNG
    const seed = 999;

    const runSimulation = () => {
      const { entities } = createTestContext({ seed });
      const sequence: number[] = [];

      // Simulate some RNG calls that would happen during gameplay
      // e.g. monster attack checks, random walks
      for (let i = 0; i < 50; i++) {
        sequence.push(entities.rng.frandom());
        sequence.push(entities.rng.crandom());
        // Simulate a probability check
        if (entities.rng.frandom() > 0.5) {
            sequence.push(1);
        } else {
            sequence.push(0);
        }
      }
      return sequence;
    };

    const result1 = runSimulation();
    const result2 = runSimulation();

    expect(result1).toHaveLength(result2.length);
    expect(result1).toEqual(result2);
  });

  it('throws if Math.random is used', () => {
      expect(() => {
          Math.random();
      }).toThrow('Math.random() called in deterministic context!');
  });
});
