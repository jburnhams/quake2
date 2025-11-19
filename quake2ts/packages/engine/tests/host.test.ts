import { describe, expect, it, vi } from 'vitest';
import { EngineHost, type GameFrameResult } from '../src/host.js';

interface StubState {
  readonly id: string;
}

describe('EngineHost', () => {
  it('initializes game and client before starting the loop', () => {
    const scheduled: Array<() => void> = [];
    const initialState: GameFrameResult<StubState> = { frame: 0, timeMs: 0, state: { id: 'seed' } };

    const game = {
      init: vi.fn(() => initialState),
      frame: vi.fn(),
      shutdown: vi.fn(),
    };

    const client = {
      init: vi.fn(),
      render: vi.fn(),
      shutdown: vi.fn(),
    };

    const host = new EngineHost(game, client, {
      loop: { schedule: (cb) => scheduled.push(cb), now: () => 0, fixedDeltaMs: 25 },
      startTimeMs: 0,
    });

    host.start();

    expect(game.init).toHaveBeenCalledWith(0);
    expect(client.init).toHaveBeenCalledWith(initialState);
    expect(scheduled).toHaveLength(1);
  });

  it('defaults start time to the loop clock when not provided explicitly', () => {
    const game = {
      init: vi.fn(() => ({ frame: 0, timeMs: 123 } satisfies GameFrameResult)),
      frame: vi.fn(),
      shutdown: vi.fn(),
    };

    const host = new EngineHost(game, undefined, {
      loop: { schedule: () => {}, now: () => 123, fixedDeltaMs: 25 },
    });

    host.start();

    expect(game.init).toHaveBeenCalledWith(123);
  });

  it('uses the provided start time for both game init and loop timestamps', () => {
    const frames: GameFrameResult[] = [];

    const game = {
      init: vi.fn((timeMs: number) => ({ frame: 0, timeMs } satisfies GameFrameResult)),
      frame: vi.fn(({ frame, nowMs }) => {
        const result = { frame, timeMs: nowMs } satisfies GameFrameResult;
        frames.push(result);
        return result;
      }),
      shutdown: vi.fn(),
    };

    const host = new EngineHost(game, undefined, {
      startTimeMs: 500,
      loop: { schedule: () => {}, now: () => 0, fixedDeltaMs: 25, startTimeMs: 2_000 },
    });

    host.start();
    host.pump(25);

    expect(game.init).toHaveBeenCalledWith(500);
    expect(frames.at(0)?.timeMs).toBe(525);
  });

  it('steps simulation with fixed deltas and passes previous/latest frames to the client', () => {
    const renderSamples: Array<{
      previous?: GameFrameResult<StubState>;
      latest?: GameFrameResult<StubState>;
      alpha: number;
    }> = [];

    let timeMs = 0;
    const game = {
      init: vi.fn(() => ({ frame: 0, timeMs, state: { id: 'seed' } } satisfies GameFrameResult<StubState>)),
      frame: vi.fn(({ frame, deltaMs }) => {
        timeMs += deltaMs;
        return { frame, timeMs, state: { id: `frame-${frame}` } } satisfies GameFrameResult<StubState>;
      }),
      shutdown: vi.fn(),
    };

    const client = {
      init: vi.fn(),
      render: vi.fn((sample) => {
        renderSamples.push({
          previous: sample.previous,
          latest: sample.latest,
          alpha: sample.alpha,
        });
      }),
      shutdown: vi.fn(),
    };

    const host = new EngineHost(game, client, {
      loop: { schedule: () => {}, now: () => 0, fixedDeltaMs: 25 },
      startTimeMs: 0,
    });

    host.start();
    host.pump(50);

    expect(game.frame).toHaveBeenCalledTimes(2);
    const last = renderSamples.at(-1);
    expect(last?.previous?.state?.id).toBe('frame-1');
    expect(last?.latest?.state?.id).toBe('frame-2');
    expect(last?.alpha).toBeCloseTo(0, 5);
  });

  it('shuts down cleanly and avoids duplicate shutdown calls', () => {
    const scheduled: Array<() => void> = [];
    const game = {
      init: vi.fn(() => ({ frame: 0, timeMs: 0 } satisfies GameFrameResult)),
      frame: vi.fn(() => ({ frame: 1, timeMs: 25 } satisfies GameFrameResult)),
      shutdown: vi.fn(),
    };

    const client = {
      init: vi.fn(),
      render: vi.fn(),
      shutdown: vi.fn(),
    };

    const host = new EngineHost(game, client, {
      loop: { schedule: (cb) => scheduled.push(cb), now: () => 0, fixedDeltaMs: 25 },
    });

    host.start();
    host.stop();
    host.stop();

    scheduled.shift()?.();
    expect(game.shutdown).toHaveBeenCalledTimes(1);
    expect(client.shutdown).toHaveBeenCalledTimes(1);
    expect(game.frame).not.toHaveBeenCalled();
  });

  it('clears cached frames when stopping so it can restart cleanly', () => {
    const game = {
      init: vi.fn(() => ({ frame: 0, timeMs: 0 } satisfies GameFrameResult)),
      frame: vi.fn(({ frame }) => ({ frame, timeMs: frame * 25 } satisfies GameFrameResult)),
      shutdown: vi.fn(),
    };

    const host = new EngineHost(game, undefined, {
      loop: { schedule: () => {}, now: () => 0, fixedDeltaMs: 25 },
    });

    host.start();
    host.pump(25);
    expect(host.getLatestFrame()?.frame).toBe(1);

    host.stop();
    expect(host.getLatestFrame()).toBeUndefined();

    host.start();
    expect(game.init).toHaveBeenCalledTimes(2);
  });
});
