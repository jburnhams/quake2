import { describe, expect, it, vi } from 'vitest';
import { createEngineRuntime } from '../../src/runtime.js';
import type { GameFrameResult } from '../../src/host.js';

describe('EngineRuntime', () => {
  it('initializes engine before wiring the host and client', () => {
    const scheduled: Array<() => void> = [];

    const engine = {
      init: vi.fn(),
      shutdown: vi.fn(),
      createMainLoop: vi.fn(),
    };

    const initialFrame = { frame: 0, timeMs: 100 } satisfies GameFrameResult;
    const game = {
      init: vi.fn(() => initialFrame),
      frame: vi.fn(),
      shutdown: vi.fn(),
    };

    const client = {
      init: vi.fn(),
      render: vi.fn(),
      shutdown: vi.fn(),
    };

    const audioOptions = {
      registry: {} as any,
      system: {} as any,
    };
    const { runtime } = createEngineRuntime(engine, game, client, audioOptions, {
      loop: { schedule: (cb) => scheduled.push(cb), fixedDeltaMs: 25, now: () => 100 },
    });

    runtime.start();

    expect(engine.init).toHaveBeenCalledTimes(1);
    expect(game.init).toHaveBeenCalledWith(100);
    expect(client.init).toHaveBeenCalledWith(initialFrame);
    expect(runtime.isRunning()).toBe(true);
    expect(scheduled).toHaveLength(1);
  });

  it('pumps the host loop and shuts down everything in order', () => {
    const engine = {
      init: vi.fn(),
      shutdown: vi.fn(),
      createMainLoop: vi.fn(),
    };

    let timeMs = 100;
    const game = {
      init: vi.fn(() => ({ frame: 0, timeMs } satisfies GameFrameResult)),
      frame: vi.fn(({ frame, deltaMs }) => {
        timeMs += deltaMs;
        return { frame, timeMs } satisfies GameFrameResult;
      }),
      shutdown: vi.fn(),
    };

    const client = {
      init: vi.fn(),
      render: vi.fn(),
      shutdown: vi.fn(),
    };

    const audioOptions = {
      registry: {} as any,
      system: {} as any,
    };
    const { runtime } = createEngineRuntime(engine, game, client, audioOptions, {
      loop: { schedule: () => {}, fixedDeltaMs: 25, now: () => timeMs },
    });

    runtime.start();
    runtime.pump(50);

    expect(game.frame).toHaveBeenCalledTimes(2);
    expect(runtime.getLatestFrame()?.frame).toBe(2);
    expect(runtime.getLatestFrame()?.timeMs).toBe(150);

    runtime.stop();
    runtime.stop();

    expect(engine.shutdown).toHaveBeenCalledTimes(1);
    expect(game.shutdown).toHaveBeenCalledTimes(1);
    expect(client.shutdown).toHaveBeenCalledTimes(1);
    expect(runtime.isRunning()).toBe(false);
  });
});
