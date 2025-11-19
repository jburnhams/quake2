import { describe, expect, it } from 'vitest';
import { createGame } from '../src/index.js';

const ZERO_VEC3 = { x: 0, y: 0, z: 0 } as const;

const mockEngine = {
  trace(start: typeof ZERO_VEC3, end: typeof ZERO_VEC3) {
    return { start, end, fraction: 1 };
  },
};

describe('createGame', () => {
  it('initializes a snapshot using the supplied gravity vector', () => {
    const game = createGame(mockEngine, { gravity: { x: 0, y: 0, z: -800 } });
    const snapshot = game.init(1000);

    expect(snapshot?.frame).toBe(0);
    expect(snapshot?.timeMs).toBe(1000);
    expect(snapshot?.state?.gravity).toEqual({ x: 0, y: 0, z: -800 });
    expect(snapshot?.state?.origin).toEqual(ZERO_VEC3);
    expect(snapshot?.state?.velocity).toEqual(ZERO_VEC3);
    expect(snapshot?.state?.level.timeSeconds).toBeCloseTo(1, 5);
    expect(snapshot?.state?.level.frameNumber).toBe(0);
  });

  it('integrates velocity and origin over successive frames', () => {
    const game = createGame(mockEngine, { gravity: { x: 0, y: 0, z: -800 } });
    game.init(0);

    const first = game.frame({ frame: 1, deltaMs: 25, nowMs: 25 });
    const second = game.frame({ frame: 2, deltaMs: 25, nowMs: 50 });

    expect(first.state?.velocity.z).toBeCloseTo(-20, 5);
    expect(first.state?.origin.z).toBeCloseTo(-0.5, 5);
    expect(first.state?.level.frameNumber).toBe(1);
    expect(first.state?.level.timeSeconds).toBeCloseTo(0.025, 5);
    expect(second.state?.velocity.z).toBeCloseTo(-40, 5);
    expect(second.state?.origin.z).toBeCloseTo(-1.5, 5);
    expect(second.state?.level.previousTimeSeconds).toBeCloseTo(0.025, 5);
    expect(second.state?.level.timeSeconds).toBeCloseTo(0.05, 5);
  });
});
