import { describe, expect, it, vi, afterEach } from 'vitest';
import { EngineHost } from '../../../src/host.js';
import { createMockGameSimulation, createMockClientRenderer } from '@quake2ts/test-utils';

describe('Full engine initialization tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete startup sequence from cold start', async () => {
    const game = createMockGameSimulation();
    const client = createMockClientRenderer();

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
    const game = createMockGameSimulation();
    const client = createMockClientRenderer();

    const host = new EngineHost(game, client);
    await host.start();

    // Stop the engine
    host.stop();

    expect(game.shutdown).toHaveBeenCalled();
    expect(client.shutdown).toHaveBeenCalled();
  });

  it('should load minimal configuration', async () => {
    const game = createMockGameSimulation();
    const client = createMockClientRenderer();

    const host = new EngineHost(game, client);

    await host.start();

    expect(game.init).toHaveBeenCalled();
    host.stop();
  });
});
