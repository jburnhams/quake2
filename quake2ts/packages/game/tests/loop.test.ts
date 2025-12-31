import { describe, expect, it } from 'vitest';
import { GameFrameLoop } from '../src/loop.js';
import { MoveType } from '../src/entities/entity.js';
import { EntitySystem } from '../src/entities/system.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils/game/helpers';
import { createTraceMock } from '@quake2ts/test-utils/shared/collision';

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

  it('allows adding and removing stage handlers while preserving order', () => {
    const loop = new GameFrameLoop();
    const order: string[] = [];

    loop.addStage('prep', () => order.push('prep-a'));
    const disposePrep = loop.addStage('prep', () => order.push('prep-b'));
    const disposeSim = loop.addStage('simulate', () => order.push('sim-a'));
    loop.addStage('simulate', () => order.push('sim-b'));
    const disposeFinish = loop.addStage('finish', () => order.push('finish-a'));

    loop.reset(0);
    loop.advance({ frame: 1, deltaMs: 25, nowMs: 25 });
    expect(order).toEqual(['prep-a', 'prep-b', 'sim-a', 'sim-b', 'finish-a']);

    disposePrep();
    disposeSim();
    disposeFinish();
    order.length = 0;

    loop.advance({ frame: 2, deltaMs: 25, nowMs: 50 });
    expect(order).toEqual(['prep-a', 'sim-b']);
  });

  it('survives handlers removing themselves mid-stage without skipping others', () => {
    const loop = new GameFrameLoop();
    const order: string[] = [];

    const disposePrep = loop.addStage('prep', () => {
      order.push('prep-a');
      disposePrep();
    });

    loop.addStage('prep', () => order.push('prep-b'));

    const disposeSim = loop.addStage('simulate', () => {
      order.push('sim-a');
      disposeSim();
    });

    loop.addStage('simulate', () => order.push('sim-b'));

    loop.addStage('finish', () => order.push('finish-a'));

    loop.reset(0);
    loop.advance({ frame: 1, deltaMs: 25, nowMs: 25 });

    expect(order).toEqual(['prep-a', 'prep-b', 'sim-a', 'sim-b', 'finish-a']);

    order.length = 0;
    loop.advance({ frame: 2, deltaMs: 25, nowMs: 50 });
    expect(order).toEqual(['prep-b', 'sim-b', 'finish-a']);
  });

  it('throws if no simulate stages are registered', () => {
    const loop = new GameFrameLoop();
    loop.addStage('prep', () => {});
    loop.reset(0);
    expect(() => loop.advance({ frame: 1, deltaMs: 25, nowMs: 25 })).toThrow(
      /simulate stage/,
    );
  });
});

describe('GameFrameLoop Physics Integration', () => {
  it('should call the correct physics function for an entity with MOVETYPE_TOSS', () => {
    const { imports } = createGameImportsAndEngine({
      imports: {
        trace: () => createTraceMock({ fraction: 1.0 })
      }
    });

    const entitySystem = new EntitySystem({} as any, imports, { x: 0, y: 0, z: -800 });
    const ent = entitySystem.spawn();
    ent.movetype = MoveType.Toss;
    ent.velocity = { x: 0, y: 0, z: 100 };

    const loop = new GameFrameLoop();
    loop.addStage('simulate', () => entitySystem.runFrame());
    loop.reset(0);
    entitySystem.beginFrame(0.1);
    loop.advance({
      frame: 1,
      lastFrameTime: 0,
      totalElapsed: 100,
      extrapolation: 0,
      deltaSeconds: 0.1,
    });

    // Check that gravity was applied
    expect(ent.velocity.z).toBeLessThan(100);
  });

  it('should initialize the timestamp of a newly spawned entity', () => {
    const entitySystem = new EntitySystem({} as any, {} as any, { x: 0, y: 0, z: 0 });
    entitySystem.beginFrame(123.45);
    const ent = entitySystem.spawn();
    expect(ent.timestamp).toBe(123.45);
  });
});
