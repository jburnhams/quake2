import { describe, expect, it } from 'vitest';
import { GameFrameLoop } from '../src/loop.js';

const noopStep = { frame: 1, deltaMs: 25, nowMs: 25 };

describe('GameFrameLoop', () => {
  it('runs prep, simulate, and finish hooks in order while advancing level time', () => {
    const order: string[] = [];

    const loop = new GameFrameLoop({
      prep: ({ frame, previousTimeMs, timeMs, deltaSeconds }) => {
        order.push(`prep-${frame}`);
        expect(previousTimeMs).toBe(0);
        expect(timeMs).toBe(25);
        expect(deltaSeconds).toBeCloseTo(0.025, 5);
      },
      simulate: ({ frame }) => {
        order.push(`run-${frame}`);
      },
      finish: ({ frame }) => {
        order.push(`finish-${frame}`);
      },
    });

    loop.reset(0);
    const context = loop.advance(noopStep);

    expect(context.timeMs).toBe(25);
    expect(context.previousTimeMs).toBe(0);
    expect(order).toEqual(['prep-1', 'run-1', 'finish-1']);
    expect(loop.frameNumber).toBe(1);
  });

  it('carries the accumulated time between steps', () => {
    const loop = new GameFrameLoop({ simulate: () => {} });
    loop.reset(100);

    const first = loop.advance({ frame: 1, deltaMs: 25, nowMs: 125 });
    const second = loop.advance({ frame: 2, deltaMs: 50, nowMs: 175 });

    expect(first.timeMs).toBe(125);
    expect(first.previousTimeMs).toBe(100);
    expect(second.timeMs).toBe(175);
    expect(second.previousTimeMs).toBe(125);
    expect(loop.time).toBe(175);
  });
});
