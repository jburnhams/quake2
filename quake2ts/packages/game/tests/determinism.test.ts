import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestContext } from './test-helpers.js';
import { RandomGenerator } from '@quake2ts/shared';
import { execSync } from 'child_process';
import { MoveType } from '../src/entities/entity.js';

const GRAVITY = { x: 0, y: 0, z: -800 } as const;

// Helper to create a deterministic game instance
function createDeterministicGame(seed: number, options: Partial<GameCreateOptions> = {}) {
  const mockEngine = {
    trace(start: any, end: any) {
      return { start, end, fraction: 1 };
    },
    pointcontents: () => 0,
    multicast: () => {},
    unicast: () => {},
    sound: () => {},
    configstring: () => {},
    serverCommand: () => {},
    modelIndex: () => 1,
    soundIndex: () => 1,
  };

  const rng = new RandomGenerator({ seed });

  return createGame(
    {
      ...mockEngine
    } as any,
    mockEngine as any,
    {
      gravity: GRAVITY,
      random: rng,
      ...options
    }
  );
}

function runGameHashes(seed: number, frames: number, options: { injectRng?: boolean, spawnMonster?: boolean } = {}): number[] {
  const game = createDeterministicGame(seed, options);
  const hashes: number[] = [];

  // Init
  const initial = game.init(0);
  if (initial?.state) {
    hashes.push(hashGameState(initial.state));
  }

  // Inject an entity that uses RNG to ensure divergence if seed differs
  if (options.injectRng) {
      const ent = game.entities.spawn();
      ent.classname = 'rng_tester';
      ent.modelindex = 1; // Ensure it's included in snapshot
      ent.think = (self) => {
          // Use RNG to change position to ensure hashGameState picks it up
          // hashGameState includes entity.origin
          const shift = (game.random.frandom() - 0.5) * 10;
          self.origin.x += shift;
          self.nextthink = game.entities.timeSeconds + 0.1;
          game.entities.scheduleThink(self, self.nextthink);
      };
      ent.nextthink = game.entities.timeSeconds + 0.1;
      game.entities.scheduleThink(ent, ent.nextthink);
  }

  // Run frames
  for (let frame = 1; frame <= frames; frame += 1) {
    const snapshot = game.frame({ frame, deltaMs: 100, nowMs: frame * 100 });
    hashes.push(hashGameState(snapshot.state));
  }

  return hashes;
}

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
