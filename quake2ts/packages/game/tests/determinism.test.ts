import { describe, it, expect, vi } from 'vitest';
import { createTestContext } from './test-helpers';
import { Entity, MoveType } from '../src/entities/entity';
import { Vec3, RandomGenerator, createRandomGenerator } from '@quake2ts/shared';
import { monster_soldier } from '../src/entities/monsters/soldier';
import { EntitySystem } from '../src/entities/system';
import { execSync } from 'child_process';

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
  it('should produce identical state for identical seeds', async () => {
    const seed = 12345;
    const ticks = 20;

    const runSimulation = (seed: number): number[] => {
      const context = createTestContext({ seed });
      const { entities } = context;

      const monster = new Entity(1);
      monster.classname = 'monster_test';
      monster.origin = { x: 0, y: 0, z: 0 };

      // We must explicitly ensure 'think' is called by the test loop,
      // or that the monster is in a list that would be iterated if we were using a real runFrame.
      // Since we are running a manual loop, we check nextthink.

      monster.think = (self: Entity) => {
          // Use the RNG attached to the game object
          const r = entities.game.random.frandom();
          self.origin.x += r * 10;
          self.nextthink = entities.timeSeconds + 0.1;
          return true;
      };
      monster.nextthink = 0.1; // Set initial nextthink

      const positionsX: number[] = [];
      let currentTime = 0;
      entities.timeSeconds = 0;

      for (let i = 0; i < ticks; i++) {
        currentTime = Number((currentTime + 0.1).toFixed(1));
        entities.timeSeconds = currentTime;

        // Debug
        // console.log(`Tick ${i}, Time ${currentTime}, NextThink ${monster.nextthink}`);

        if (monster.nextthink > 0 && monster.nextthink <= currentTime + 0.001) { // Epsilon for float comparison
            const think = monster.think;
             // Clear nextthink before calling, standard engine behavior
             // But here we just call it.
            monster.think(monster);
        }

        positionsX.push(monster.origin.x);
      }
      return positionsX;
    };

    const run1 = runSimulation(seed);
    const run2 = runSimulation(seed);
    const run3 = runSimulation(seed + 1);

    const sum = run1.reduce((a, b) => a + b, 0);
    // If sum is 0, it means monster never moved, so RNG was never called or produced 0s (unlikely).
    expect(sum).toBeGreaterThan(0);

    expect(run1).toEqual(run2);
    expect(run1).not.toEqual(run3);
  });
});
