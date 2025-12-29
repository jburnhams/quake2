import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupBrowserEnvironment } from './setup.js';
import { EngineHost } from '@quake2ts/engine';
import type { GameExports } from '@quake2ts/game';
import type { ClientExports } from '@quake2ts/client';

// Helper to create minimal mocks
const createMockGame = (): GameExports => {
  const game = {
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
  } as unknown as GameExports;

  // Adapt to GameSimulation interface
  (game as any).frame = game.runFrame;

  return game;
};

const createMockClient = (): ClientExports => ({
  init: vi.fn(),
  shutdown: vi.fn(),
  render: vi.fn(),
  runFrame: vi.fn(),
  onEvent: vi.fn(),
  getExports: vi.fn()
} as unknown as ClientExports);

describe('Full engine initialization tests', () => {
  beforeEach(() => {
    setupBrowserEnvironment();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete startup sequence from cold start', async () => {
    const game = createMockGame();
    const client = createMockClient();

    const host = new EngineHost(game, client, {
      // fileSystem and audio mocks are not strictly needed if EngineHost creates defaults or handles missing ones gracefully
      // But to be safe we can mock them if needed. EngineHost constructor doesn't require them.
    });

    await host.start();

    expect(game.init).toHaveBeenCalled();
    expect(client.init).toHaveBeenCalled();

    host.stop();
  });

  it('should clean shutdown', async () => {
    const game = createMockGame();
    const client = createMockClient();

    const host = new EngineHost(game, client);
    await host.start();

    // Stop the engine
    host.stop();

    expect(game.shutdown).toHaveBeenCalled();
    expect(client.shutdown).toHaveBeenCalled();
  });

  it('should load minimal configuration', async () => {
    const game = createMockGame();
    const client = createMockClient();

    const host = new EngineHost(game, client);

    await host.start();

    expect(game.init).toHaveBeenCalled();
    host.stop();
  });
});
