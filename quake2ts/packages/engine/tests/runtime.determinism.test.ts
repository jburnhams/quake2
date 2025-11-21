import { describe, expect, it } from 'vitest';
import { createGame, hashGameState, type GameStateSnapshot } from '@quake2ts/game';
import type { Vec3 } from '@quake2ts/shared';
import { createEngine, type GameFrameResult } from '../src/index.js';
import { createEngineRuntime } from '../src/runtime.js';

type ClientState = GameStateSnapshot;

const GRAVITY = { x: 0, y: 0, z: -800 } as const;

function createStubEngine() {
  const trace = (start: Vec3, end: Vec3) => ({
    start,
    end,
    fraction: 1,
  });

  return { engine: createEngine({ trace }), trace };
}

describe('EngineRuntime + game integration determinism', () => {
  it('produces the rerelease baseline hashes through the host loop', () => {
    const { engine, trace } = createStubEngine();
    const hashes: number[] = [];

    const client = {
      init(initial?: GameFrameResult<ClientState>) {
        if (initial?.state) {
          hashes.push(hashGameState(initial.state));
        }
      },
      render: ({ latest }: { latest?: GameFrameResult<ClientState> }) => {
        if (latest?.state) {
          hashes.push(hashGameState(latest.state));
        }
      },
      shutdown() {
        /* no-op */
      },
    };

    const runtime = createEngineRuntime(
      engine,
      createGame(
        { trace: trace as any, pointcontents: () => 0 },
        {} as any,
        { gravity: GRAVITY },
      ),
      client,
      { loop: { schedule: () => {}, now: () => 0, fixedDeltaMs: 25 }, startTimeMs: 0 },
    );

    runtime.start();
    for (let i = 0; i < 8; i += 1) {
      runtime.pump(25);
    }

    expect(hashes).toEqual([
      514213258,
      775935058,
      3901369870,
      427324724,
      922736138,
      532101252,
      893656737,
      3518326941,
      642580255,
    ]);
  });

  it('exposes bounded interpolation alphas when the accumulator is partially filled', () => {
    const { engine, trace } = createStubEngine();
    const alphas: number[] = [];
    const latestFrames: Array<GameFrameResult<ClientState> | undefined> = [];

    const client = {
      init(initial?: GameFrameResult<ClientState>) {
        latestFrames.push(initial);
      },
      render: ({ alpha, latest }: { alpha: number; latest?: GameFrameResult<ClientState> }) => {
        alphas.push(alpha);
        latestFrames.push(latest);
      },
      shutdown() {
        /* no-op */
      },
    };

    const runtime = createEngineRuntime(
      engine,
      createGame(
        { trace: trace as any, pointcontents: () => 0 },
        {} as any,
        { gravity: GRAVITY },
      ),
      client,
      {
        loop: { schedule: () => {}, now: () => 0, fixedDeltaMs: 25, maxSubSteps: 5 },
        startTimeMs: 0,
      },
    );

    runtime.start();
    runtime.pump(12.5); // Should render alpha ~0.5 with no new frames
    runtime.pump(12.5); // Advances to frame 1, alpha near 0
    runtime.pump(200); // Clamped to 5 substeps, ends on frame 6

    expect(alphas.every((alpha) => alpha >= 0 && alpha <= 1)).toBe(true);
    expect(alphas[0]).toBeCloseTo(0.5, 5);
    expect(latestFrames.at(-1)?.frame).toBe(6);
  });
});
