import type { FixedStepContext } from '@quake2ts/engine';

export interface GameFrameContext extends FixedStepContext {
  readonly timeMs: number;
  readonly previousTimeMs: number;
  readonly deltaSeconds: number;
}

export type GameFrameStageName = 'prep' | 'simulate' | 'finish';
export type GameFrameStage = (context: GameFrameContext) => void;

export interface GameFrameStages {
  prep?(context: GameFrameContext): void;
  simulate?(context: GameFrameContext): void;
  finish?(context: GameFrameContext): void;
}

const orderedStageNames: readonly GameFrameStageName[] = [
  'prep',
  'simulate',
  'finish',
];

export class GameFrameLoop {
  private timeMs = 0;
  private frame = 0;
  private readonly stageHandlers: Record<GameFrameStageName, GameFrameStage[]> = {
    prep: [],
    simulate: [],
    finish: [],
  };

  constructor(initialStages?: GameFrameStages) {
    if (initialStages) {
      for (const stageName of orderedStageNames) {
        const handler = initialStages[stageName];
        if (handler) {
          this.addStage(stageName, handler);
        }
      }
    }
  }

  addStage(stage: GameFrameStageName, handler: GameFrameStage): () => void {
    const handlers = this.stageHandlers[stage];
    handlers.push(handler);
    return () => {
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    };
  }

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

    this.runStage('prep', context);

    if (this.stageHandlers.simulate.length === 0) {
      throw new Error('GameFrameLoop requires at least one simulate stage');
    }

    this.runStage('simulate', context);
    this.runStage('finish', context);

    return context;
  }

  private runStage(stage: GameFrameStageName, context: GameFrameContext): void {
    const handlers = this.stageHandlers[stage];
    for (const handler of handlers) {
      handler(context);
    }
  }

  get time(): number {
    return this.timeMs;
  }

  get frameNumber(): number {
    return this.frame;
  }
}
