import type { GameFrameContext } from './loop.js';

export interface LevelFrameState {
  readonly frameNumber: number;
  readonly timeSeconds: number;
  readonly previousTimeSeconds: number;
  readonly deltaSeconds: number;
}

const ZERO_STATE: LevelFrameState = {
  frameNumber: 0,
  timeSeconds: 0,
  previousTimeSeconds: 0,
  deltaSeconds: 0,
};

export class LevelClock {
  private state: LevelFrameState = ZERO_STATE;

  start(startTimeMs: number): void {
    const startSeconds = startTimeMs / 1000;
    this.state = {
      frameNumber: 0,
      timeSeconds: startSeconds,
      previousTimeSeconds: startSeconds,
      deltaSeconds: 0,
    };
  }

  tick(context: GameFrameContext): LevelFrameState {
    this.state = {
      frameNumber: context.frame,
      timeSeconds: context.timeMs / 1000,
      previousTimeSeconds: context.previousTimeMs / 1000,
      deltaSeconds: context.deltaSeconds,
    };

    return this.state;
  }

  get current(): LevelFrameState {
    return this.state;
  }
}
