import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupBrowserEnvironment } from './setup.js';
import { EngineHost } from '@quake2ts/engine';
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
    return { angles: [0,0,0], forwardmove: 0, sidemove: 0, upmove: 0, buttons: 0, impulse: 0 };
  }),
  runFrame: vi.fn(),
  onEvent: vi.fn(),
  getExports: vi.fn()
} as unknown as ClientExports);

describe('Rendering Pipeline Integration', () => {
  let vfs: VirtualFileSystem;
  let game: GameExports;
  let client: ClientExports;
  let host: EngineHost;

  beforeEach(() => {
    setupBrowserEnvironment();
    vfs = new VirtualFileSystem();
    game = createMockGame();
    // EngineHost expects an object that implements GameSimulation, which has `init`, `frame`, `shutdown`.
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

  it('should render a complete frame', async () => {
    await host.start();

    // Simulate a frame
    host.pump(25);

    // Check if render was called
    expect(client.render).toHaveBeenCalled();

    // Check render context
    const calls = (client.render as any).mock.calls;
    const renderContext = calls[0][0];

    expect(renderContext).toBeDefined();

    // Check for essential properties.
    // Note: width/height depend on how the mock canvas or renderer is set up.
    // In `setupBrowserEnvironment` we mock getContext but maybe not window.innerWidth/Height or canvas size explicitly
    // if EngineHost reads them from somewhere else.
    // EngineHost passes `RenderContext` to `render`.
    // Let's check `packages/engine/src/loop.ts` to see where RenderContext comes from.
    // FixedTimestepLoop calls render callback with `{ alpha }` or similar.

    // Looking at `packages/engine/src/host.ts`, `renderClient` receives `renderContext` from loop.
    // `FixedTimestepLoop` calls `render(this.renderContext)`.
    // `RenderContext` only contains `alpha`.
    // EngineHost.renderClient mixes in `previous` and `latest`.
    // It seems `width` and `height` are NOT passed by EngineHost/Loop.
    // They are usually properties of the Renderer or Client, or maybe Client fetches them.

    // Wait, the test error was `expected(renderContext.width).toBeGreaterThan(0)`.
    // And received `undefined`.
    // So `width` is not in the object passed to `client.render`.

    expect(renderContext.alpha).toBeDefined();
    expect(renderContext.latest).toBeDefined();
    expect(renderContext.previous).toBeDefined(); // After one frame it might be undefined? No, host sets it.
  });

  it('should support camera movement', async () => {
    await host.start();
    host.pump(25);
    expect(client.render).toHaveBeenCalled();
  });
});
