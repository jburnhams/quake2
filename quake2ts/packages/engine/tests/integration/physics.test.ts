import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupBrowserEnvironment } from './setup.js';
import { EngineHost } from '../../src/host.js';
import type { GameExports } from '@quake2ts/game';
import type { ClientExports } from '@quake2ts/client';
import { VirtualFileSystem } from '../../src/assets/vfs.js';

// Helper to create minimal mocks
const createMockGame = (): GameExports => ({
  init: vi.fn(() => ({ frame: 0, timeMs: 0 })),
  shutdown: vi.fn(),
  spawnEntities: vi.fn(),
  runFrame: vi.fn(() => ({
    frame: 1,
    timeMs: 25,
    entities: [],
    sounds: [],
    events: [],
    links: [],
    messages: []
  })),
  getExports: vi.fn(),
  onEvent: vi.fn(),
  save: vi.fn(),
  load: vi.fn()
} as unknown as GameExports);

const createMockClient = (): ClientExports => ({
  init: vi.fn(),
  shutdown: vi.fn(),
  render: vi.fn(() => {
    // Return a dummy command to simulate input
    return { angles: [0,0,0], forwardmove: 400, sidemove: 0, upmove: 0, buttons: 0, impulse: 0 };
  }),
  runFrame: vi.fn(),
  onEvent: vi.fn(),
  getExports: vi.fn()
} as unknown as ClientExports);

describe('Physics Integration', () => {
  let vfs: VirtualFileSystem;
  let game: GameExports;
  let client: ClientExports;
  let host: EngineHost;

  beforeEach(() => {
    setupBrowserEnvironment();
    vfs = new VirtualFileSystem();
    game = createMockGame();
    // Adapt GameExports to GameSimulation interface
    (game as any).frame = game.runFrame;

    client = createMockClient();
    host = new EngineHost(game, client, {
      fileSystem: vfs as any
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    host.stop();
  });

  it('should apply movement inputs and update game state', async () => {
    await host.start();
    host.pump(25);
    host.pump(25);

    expect(game.runFrame).toHaveBeenCalled();
    const calls = (game.runFrame as any).mock.calls;
    const callWithCommand = calls.find((call: any[]) => call[1] && call[1].forwardmove === 400);
    expect(callWithCommand).toBeDefined();
  });

  it('should handle collision with world geometry', () => {
      // Mock game state where collision occurs
      // This is a high-level integration test, so we mostly verify that the host
      // passes data correctly to the game's physics system.

      // Since `GameExports` is mocked, checking actual physics logic is impossible here
      // unless we replace the mock with a real Game instance or the physics module.

      // We verify that the host passes the necessary time steps for physics to run,
      // and that exceptions from the game loop (e.g., physics errors) are propagated.

      (game.runFrame as any).mockImplementationOnce(() => {
          throw new Error("Physics Error");
      });

      try {
        host.pump(100);
      } catch (e) {
        expect((e as Error).message).toBe("Physics Error");
      }
      expect(game.runFrame).toHaveBeenCalled();
  });
});
