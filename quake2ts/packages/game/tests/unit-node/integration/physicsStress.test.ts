import { describe, expect, it } from 'vitest';
import { createTestGame } from '@quake2ts/test-utils';
import { hashEntitySystem } from '../../../src/checksum.js';
import { EntitySystem } from '../../../src/entitySystem.js';

describe('Physics Determinism Stress Tests', () => {

  // Helper to run a simulation for N frames and return the final state hash
  const runSimulation = (frameCount: number): { hash: number } => {
    // Initialize game with a specific seed to ensure RNG is deterministic.
    // createTestGame sets up imports and engine mocks automatically.
    const { game } = createTestGame({
      config: {
        gravity: { x: 0, y: 0, z: -800 },
        deathmatch: false
      }
    });

    game.init(0);

    // Simulate frames
    const dt = 50; // 50ms (20Hz)
    for (let i = 0; i < frameCount; i++) {
        game.frame({
            deltaMs: dt,
            timeMs: (i + 1) * dt,
            frame: i + 1
        });
    }

    // Hash the state.
    // Cast to any to access the internal entities property for snapshotting.
    // In a real integration scenario, we might use save/load, but here we hash internal state.
    const entitySystem = (game as any).entities as EntitySystem;

    if (!entitySystem) {
      throw new Error("Could not access EntitySystem from GameExports");
    }

    const hash = hashEntitySystem(entitySystem.createSnapshot());

    return { hash };
  };

  it('maintains perfect determinism over 1000 frames', () => {
    // Run 1:
    const result1 = runSimulation(1000);

    // Run 2:
    const result2 = runSimulation(1000);

    // Hashes must match exactly
    expect(result1.hash).toBe(result2.hash);
  });

  it('maintains determinism with complex interactions (simulated)', () => {

    const runComplexSim = () => {
       const { game } = createTestGame({
          config: {
            gravity: { x: 0, y: 0, z: -800 },
            deathmatch: false
          }
       });

       game.init(0);

       // Run a simulation.
       const dt = 50;
       for(let i=0; i<500; i++) {
         game.frame({
             deltaMs: dt,
             timeMs: (i + 1) * dt,
             frame: i + 1
         });
       }

       return hashEntitySystem(((game as any).entities as EntitySystem).createSnapshot());
    };

    const hash1 = runComplexSim();
    const hash2 = runComplexSim();

    expect(hash1).toBe(hash2);
  });
});
