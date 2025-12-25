import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupBrowserEnvironment } from '@quake2ts/test-utils';
import { createGame, type GameExports } from '../../src/index.js';
import type { GameImports } from '../../src/imports.js';
import { Vec3 } from '@quake2ts/shared';

// Mock GameImports
const createMockGameImports = (): GameImports => ({
  trace: vi.fn((start, mins, maxs, end) => ({
    fraction: 1.0,
    allsolid: false,
    startsolid: false,
    endpos: { ...end }, // Return end as endpos for fraction 1
    plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
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
  cvar_get: vi.fn(),
  cvar_set: vi.fn(),
  cvar_forceset: vi.fn(),
  argc: vi.fn(() => 0),
  argv: vi.fn(() => ''),
  args: vi.fn(() => ''),
  positiondms: vi.fn()
} as unknown as GameImports);

describe('Full Gameplay Scenario Integration', () => {
  let game: GameExports;
  let imports: GameImports;

  beforeEach(() => {
    setupBrowserEnvironment();
    imports = createMockGameImports();
    const mockEngine = {
        trace: vi.fn(),
    };

    game = createGame(imports, mockEngine as any, { gravity: { x: 0, y: 0, z: -800 } });
    game.init(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete base1 level sequence simulation', () => {
    // 1. Load Map (Simulated)
    const world = game.entities.spawn();
    world.classname = 'worldspawn';

    // 2. Spawn Player
    game.spawnWorld();
    const player = game.entities.find(e => e.classname === 'player');
    expect(player).toBeDefined();

    // 3. Simulate Input/Movement
    const cmd = {
        angles: { x: 0, y: 0, z: 0 },
        forwardmove: 200,
        sidemove: 0,
        upmove: 0,
        buttons: 0,
        msec: 100,
        serverFrame: 1
    };

    // Run simulation
    for (let i = 0; i < 10; i++) {
        game.frame({
            deltaMs: 100,
            timeMs: (i + 1) * 100,
            frame: i + 1
        }, cmd);
    }

    // Verify player moved (assumes updated trace mock works)
    expect(player?.origin.x).toBeGreaterThan(0);
  });
});
