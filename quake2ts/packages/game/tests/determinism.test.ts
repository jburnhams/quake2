import { describe, it, expect } from 'vitest';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { Entity } from '../src/entities/entity.js';

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

        if (monster.nextthink > 0 && monster.nextthink <= currentTime + 0.001) { // Epsilon for float comparison
            // Clear nextthink before calling, standard engine behavior
            // But here we just call it.
            if (monster.think) {
              monster.think(monster);
            }
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
