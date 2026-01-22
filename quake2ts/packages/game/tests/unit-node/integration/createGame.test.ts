import { describe, expect, it, vi } from 'vitest';
import { createTestGame, createTraceMock, ZERO_VEC3 } from '@quake2ts/test-utils';

describe('createGame', () => {
  it('initializes a snapshot using the supplied gravity vector', () => {
    const { game } = createTestGame({
      config: { gravity: { x: 0, y: 0, z: -800 } }
    });

    // Explicitly initialize the game to get a fresh snapshot
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
    // We need the trace to return the end position as if it was a clear path,
    // to match the original test's assumption that movement succeeds fully.
    const { game } = createTestGame({
      engine: {
        trace: vi.fn((start, end) => createTraceMock({
          fraction: 1,
          endpos: end
        }))
      },
      config: { gravity: { x: 0, y: 0, z: -800 } }
    });

    game.init(0);
    game.spawnWorld();

    const first = game.frame({ frame: 1, deltaMs: 25, nowMs: 25 });
    const player = game.entities.find((e) => e.classname === 'player');

    expect(player?.velocity.z).toBeCloseTo(-20, 5);
    expect(player?.origin.z).toBeCloseTo(-0.5, 5);
    expect(first.state?.level.frameNumber).toBe(1);
    expect(first.state?.level.timeSeconds).toBeCloseTo(0.025, 5);

    const second = game.frame({ frame: 2, deltaMs: 25, nowMs: 50 });
    const secondPlayer = game.entities.find((e) => e.classname === 'player');
    expect(secondPlayer?.velocity.z).toBeCloseTo(-40, 5);
    expect(secondPlayer?.origin.z).toBeCloseTo(-1.5, 5);
    expect(second.state?.level.previousTimeSeconds).toBeCloseTo(0.025, 5);
    expect(second.state?.level.timeSeconds).toBeCloseTo(0.05, 5);
  });
});
