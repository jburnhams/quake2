import { describe, expect, it } from 'vitest';
import { FixedTimestepLoop } from '@quake2ts/engine/loop.js';

function recorders() {
  const simulated: number[] = [];
  const alphas: number[] = [];
  const steps: Array<{ frame: number; nowMs: number }> = [];

  return {
    simulated,
    alphas,
    steps,
    loop: new FixedTimestepLoop(
      {
        simulate: ({ frame, nowMs }) => {
          simulated.push(frame);
          steps.push({ frame, nowMs });
        },
        render: ({ alpha }) => {
          alphas.push(alpha);
        },
      },
      { schedule: () => {}, now: () => 0, fixedDeltaMs: 25 },
    ),
  };
}

describe('FixedTimestepLoop', () => {
  it('accumulates elapsed time before stepping the simulation', () => {
    const { loop, simulated, alphas } = recorders();

    loop.pump(10);
    expect(simulated).toHaveLength(0);
    expect(alphas.at(-1)).toBeCloseTo(0.4, 5);

    loop.pump(15);
    expect(simulated).toEqual([1]);
    expect(alphas.at(-1)).toBeCloseTo(0, 5);
  });

  it('runs multiple fixed steps when the accumulator allows and exposes interpolation alpha', () => {
    const { loop, simulated, alphas } = recorders();

    loop.pump(90);

    expect(simulated).toEqual([1, 2, 3]);
    expect(alphas.at(-1)).toBeCloseTo(0.6, 5);
  });

  it('caps catch-up work to the configured substep window', () => {
    const simulated: number[] = [];
    const loop = new FixedTimestepLoop(
      {
        simulate: ({ frame }) => simulated.push(frame),
      },
      { schedule: () => {}, now: () => 0, fixedDeltaMs: 25, maxSubSteps: 3 },
    );

    loop.pump(200);
    expect(simulated).toEqual([1, 2, 3]);
    expect(loop.frameNumber).toBe(3);
  });

  it('clamps elapsed time before accumulation to avoid runaway steps', () => {
    const simulated: Array<{ frame: number; nowMs: number }> = [];
    const alphas: number[] = [];

    const loop = new FixedTimestepLoop(
      {
        simulate: ({ frame, nowMs }) => simulated.push({ frame, nowMs }),
        render: ({ alpha }) => alphas.push(alpha),
      },
      { schedule: () => {}, now: () => 0, fixedDeltaMs: 25, maxSubSteps: 4, maxDeltaMs: 30 },
    );

    loop.pump(-100);
    expect(simulated).toHaveLength(0);
    expect(alphas.at(-1)).toBe(0);

    loop.pump(200);
    expect(simulated).toEqual([{ frame: 1, nowMs: 100 }]);
    expect(alphas.at(-1)).toBeCloseTo(0.2, 5);
  });

  it('anchors the first scheduled tick to the configured start time', () => {
    const simulated: number[] = [];
    const scheduled: Array<() => void> = [];
    let now = 500;

    const loop = new FixedTimestepLoop(
      {
        simulate: ({ frame, nowMs }) => {
          simulated.push(frame);
          expect(nowMs).toBe(now);
        },
      },
      {
        fixedDeltaMs: 25,
        startTimeMs: 500,
        now: () => now,
        schedule: (cb) => {
          scheduled.push(cb);
        },
      },
    );

    loop.start();
    expect(loop.isRunning()).toBe(true);
    expect(scheduled).toHaveLength(1);

    now += 25;
    scheduled.shift()?.();
    expect(simulated).toEqual([1]);
    expect(loop.frameNumber).toBe(1);
    expect(scheduled).toHaveLength(1);

    now += 25;
    scheduled.shift()?.();
    expect(simulated).toEqual([1, 2]);
  });

  it('schedules ticks while running and stops cleanly', () => {
    const simulated: number[] = [];
    const scheduled: Array<() => void> = [];
    let now = 0;

    const loop = new FixedTimestepLoop(
      {
        simulate: ({ frame }) => simulated.push(frame),
      },
      {
        fixedDeltaMs: 25,
        now: () => now,
        schedule: (cb) => {
          scheduled.push(cb);
        },
      },
    );

    loop.start();
    expect(loop.isRunning()).toBe(true);
    expect(scheduled).toHaveLength(1);

    now += 25;
    scheduled.shift()?.();
    expect(simulated).toEqual([1]);
    expect(scheduled).toHaveLength(1);

    loop.stop();
    scheduled.shift()?.();
    expect(simulated).toEqual([1]);
    expect(loop.isRunning()).toBe(false);
  });
});
