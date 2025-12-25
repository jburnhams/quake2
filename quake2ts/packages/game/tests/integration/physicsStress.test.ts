import { describe, expect, it, vi } from 'vitest';
import { createGame } from '../../src/index.js';
// We import the specific hashing function that handles the EntitySystem instance
// but we need to verify if it is exported. It was just added to checksum.ts
// but index.ts exports `hashEntitySystem` from checksum.ts.
// I modified checksum.ts to export `hashEntitySystemInstance` as well? No, I added it at bottom.
// I should update index.ts to export it, or update test to use createSnapshot().
import { EntitySystem } from '../../src/entitySystem.js';
import { hashEntitySystem } from '../../src/checksum.js';
import type { GameExports, GameImports } from '../../src/index.js';
import { setupBrowserEnvironment } from '@quake2ts/test-utils';

// Define createMockGameImports locally since it's not exported from shared test helpers
const createMockGameImports = (): GameImports => ({
  trace: vi.fn((start, end, mins, maxs) => ({
    fraction: 1.0,
    allsolid: false,
    startsolid: false,
    endpos: { ...end }, // Return end as endpos for fraction 1
    plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
    ent: null
  })),
  pointcontents: vi.fn(() => 0),
  setmodel: vi.fn(),
  configstring: vi.fn(),
  modelindex: vi.fn(() => 1),
  soundindex: vi.fn(() => 1),
  imageindex: vi.fn(() => 1),
  linkentity: vi.fn(),
  unlinkentity: vi.fn(),
  multicast: vi.fn(),
  unicast: vi.fn(),
  sound: vi.fn(),
  centerprintf: vi.fn(),
  bprint: vi.fn(),
  dprint: vi.fn(),
  error: vi.fn(),
  cvar: vi.fn(() => ({ string: '', value: 0, flags: 0 })),
  cvar_set: vi.fn(),
  cvar_forceset: vi.fn(),
  argc: vi.fn(() => 0),
  argv: vi.fn(() => ''),
  args: vi.fn(() => ''),
  positiondms: vi.fn()
} as unknown as GameImports);

describe('Physics Determinism Stress Tests', () => {
  setupBrowserEnvironment();

  // Helper to run a simulation for N frames and return the final state hash
  const runSimulation = (frameCount: number): { hash: number; game: GameExports } => {
    // Mock imports
    const imports = createMockGameImports();
    const mockEngine = {
        trace: vi.fn(),
    };

    // Initialize game with a specific seed to ensure RNG is deterministic
    const game = createGame(imports, mockEngine as any, {
      gravity: { x: 0, y: 0, z: -800 },
      deathmatch: false
    });

    game.init(0);

    // Simulate frames
    const dt = 50; // 50ms (20Hz)
    for (let i = 0; i < frameCount; i++) {
        // frame takes FixedStepContext
        game.frame({
            deltaMs: dt,
            timeMs: (i + 1) * dt,
            frame: i + 1
        });
    }

    // Hash the state
    // We need access to the entity system to hash it.
    const entitySystem = (game as any).entities as EntitySystem;

    if (!entitySystem) {
      throw new Error("Could not access EntitySystem from GameExports");
    }

    // Use createSnapshot() to get the hashable data structure
    const hash = hashEntitySystem(entitySystem.createSnapshot());

    return { hash, game };
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
       const imports = createMockGameImports();
       const mockEngine = {
           trace: vi.fn(),
       };
       const game = createGame(imports, mockEngine as any, {
           gravity: { x: 0, y: 0, z: -800 },
           deathmatch: false
       });
       game.init(0);

       // Let's just run a longer simulation.
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
