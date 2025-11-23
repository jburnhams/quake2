import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupBrowserEnvironment } from '@quake2ts/tests/src/setup.js';
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
  render: vi.fn(),
  runFrame: vi.fn(),
  onEvent: vi.fn(),
  getExports: vi.fn()
} as unknown as ClientExports);

describe('Map Loading Integration', () => {
  let vfs: VirtualFileSystem;
  let game: GameExports;
  let client: ClientExports;
  let host: EngineHost;

  beforeEach(() => {
    setupBrowserEnvironment();
    vfs = new VirtualFileSystem();
    game = createMockGame();
    client = createMockClient();
    host = new EngineHost(game, client, {
      fileSystem: vfs as any
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call spawnEntities when map is loaded', async () => {
    // Create dummy map data
    const mapName = 'maps/base1.bsp';
    const entities = '{ "classname": "worldspawn" }';
    const spawnPoint = { origin: [0, 0, 0], angle: 0 };

    game.spawnEntities(mapName, entities, spawnPoint as any);

    expect(game.spawnEntities).toHaveBeenCalledWith(mapName, entities, spawnPoint);
  });
});
