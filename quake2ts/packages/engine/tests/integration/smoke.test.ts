import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createEngineRuntime } from '../../src/runtime.js';
import type { GameFrameResult, GameSimulation, ClientExports, ClientImports } from '../../src/host.js';
import { EngineRuntime } from '../../src/runtime.js';

describe('Integration Point Smoke Tests', () => {
  let runtime: EngineRuntime;
  let game: any;
  let client: any;
  let engine: any;

  beforeEach(() => {
     engine = {
      init: vi.fn(),
      shutdown: vi.fn(),
      createMainLoop: vi.fn(),
      // Mock imports provided by engine to game/client if needed
    };

    const initialFrame = { frame: 0, timeMs: 100 } satisfies GameFrameResult;
    game = {
      init: vi.fn(() => initialFrame),
      frame: vi.fn((ctx) => ({ frame: ctx.frame, timeMs: ctx.timeMs })),
      shutdown: vi.fn(),
      // Mock configstring emission capability
      emitConfigString: vi.fn(),
    };

    client = {
      init: vi.fn(),
      render: vi.fn(),
      shutdown: vi.fn(),
      // Mock client receiving state
      receiveConfigString: vi.fn(),
    };

    runtime = createEngineRuntime(engine, game, client, {
      loop: { schedule: () => {}, fixedDeltaMs: 25, now: () => 100 },
    });
  });

  it('verifies game/client entrypoint invocation order', () => {
    runtime.start();

    // Engine init first
    expect(engine.init).toHaveBeenCalled();

    // Game init second, providing initial state
    expect(game.init).toHaveBeenCalled();
    expect(engine.init.mock.invocationCallOrder[0]).toBeLessThan(game.init.mock.invocationCallOrder[0]);

    // Client init third, receiving initial state
    expect(client.init).toHaveBeenCalled();
    expect(game.init.mock.invocationCallOrder[0]).toBeLessThan(client.init.mock.invocationCallOrder[0]);
  });

  it('validates frame data flow from game to client', () => {
    runtime.start();

    // Simulate one frame
    runtime.pump(25);

    expect(game.frame).toHaveBeenCalled();
    const gameResult = game.frame.mock.results[0].value;

    expect(client.render).toHaveBeenCalled();
    // Client render typically takes the latest frame (snapshot) and an interpolation alpha
    // Verify client render was called with the game's output state
    const renderCall = client.render.mock.calls[0];

    // Arguments to render is a SINGLE object (GameRenderSample)
    // which contains alpha, previous, latest.
    // Argument 0: GameRenderSample
    expect(renderCall.length).toBe(1);

    const sample = renderCall[0];
    expect(sample).toHaveProperty('alpha');
    expect(sample).toHaveProperty('latest');
    expect(sample.latest).toEqual(gameResult);
  });

  it('ensures shutdown propagates correctly across all systems', () => {
    runtime.start();
    runtime.stop();

    expect(client.shutdown).toHaveBeenCalled();
    expect(game.shutdown).toHaveBeenCalled();
    expect(engine.shutdown).toHaveBeenCalled();

    // Order matters: usually Client -> Game -> Engine (reverse of startup)
    // or Game -> Client -> Engine depending on dependency.
    // Engine runtime typically stops loop, then shutdowns components.
    // Let's check generally that all were called.
  });
});
