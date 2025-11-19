import type { FixedStepContext } from '@quake2ts/engine';

export interface GameFrameContext extends FixedStepContext {
  readonly timeMs: number;
  readonly previousTimeMs: number;
  readonly deltaSeconds: number;
}

export interface GameFrameStages {
  prep?(context: GameFrameContext): void;
  simulate(context: GameFrameContext): void;
  finish?(context: GameFrameContext): void;
}

export class GameFrameLoop {
  private timeMs = 0;
  private frame = 0;

  constructor(private readonly stages: GameFrameStages) {}

  reset(startTimeMs: number): void {
    this.timeMs = startTimeMs;
    this.frame = 0;
  }

  advance(step: FixedStepContext): GameFrameContext {
    const previousTimeMs = this.timeMs;
    this.timeMs = previousTimeMs + step.deltaMs;
    this.frame = step.frame;

    const context: GameFrameContext = {
      ...step,
      timeMs: this.timeMs,
      previousTimeMs,
      deltaSeconds: step.deltaMs / 1000,
    };

    this.stages.prep?.(context);
    this.stages.simulate(context);
    this.stages.finish?.(context);

    return context;
  }

  get time(): number {
    return this.timeMs;
  }

  get frameNumber(): number {
    return this.frame;
  }
}
