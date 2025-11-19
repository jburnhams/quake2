import { describe, expect, it } from 'vitest';
import { LevelClock } from '../src/level.js';
import type { GameFrameContext } from '../src/loop.js';

const mockContext = (overrides: Partial<GameFrameContext>): GameFrameContext => ({
  frame: 0,
  deltaMs: 0,
  nowMs: 0,
  timeMs: 0,
  previousTimeMs: 0,
  deltaSeconds: 0,
  ...overrides,
});

describe('LevelClock', () => {
  it('starts from the supplied absolute time', () => {
    const clock = new LevelClock();
    clock.start(1500);
    expect(clock.current.timeSeconds).toBeCloseTo(1.5, 5);
    expect(clock.current.frameNumber).toBe(0);
  });

  it('tracks frame/frame time transitions using the supplied frame context', () => {
    const clock = new LevelClock();
    clock.start(0);

    const first = clock.tick(
      mockContext({ frame: 1, timeMs: 100, previousTimeMs: 0, deltaSeconds: 0.1 }),
    );
    expect(first.frameNumber).toBe(1);
    expect(first.timeSeconds).toBeCloseTo(0.1, 5);
    expect(first.previousTimeSeconds).toBeCloseTo(0, 5);

    const second = clock.tick(
      mockContext({ frame: 2, timeMs: 200, previousTimeMs: 100, deltaSeconds: 0.1 }),
    );
    expect(second.frameNumber).toBe(2);
    expect(second.previousTimeSeconds).toBeCloseTo(0.1, 5);
    expect(second.timeSeconds).toBeCloseTo(0.2, 5);
    expect(clock.current).toEqual(second);
  });
});
