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

type StageBuckets = Record<GameFrameStageName, (GameFrameStage | undefined)[]>;
type StageCounts = Record<GameFrameStageName, number>;
type StageCompactionFlags = Record<GameFrameStageName, boolean>;

export class GameFrameLoop {
  private timeMs = 0;
  private frame = 0;
  private readonly stageHandlers: StageBuckets = {
    prep: [],
    simulate: [],
    finish: [],
  };
  private readonly stageCounts: StageCounts = {
    prep: 0,
    simulate: 0,
    finish: 0,
  };
  private readonly stageCompactionNeeded: StageCompactionFlags = {
    prep: false,
    simulate: false,
    finish: false,
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
    this.stageCounts[stage] += 1;

    return () => {
      const index = handlers.indexOf(handler);
      if (index >= 0 && handlers[index]) {
        handlers[index] = undefined;
        this.stageCounts[stage] -= 1;
        this.stageCompactionNeeded[stage] = true;
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

    if (this.stageCounts.simulate === 0) {
      throw new Error('GameFrameLoop requires at least one simulate stage');
    }

    this.runStage('simulate', context);
    this.runStage('finish', context);

    return context;
  }

  private runStage(stage: GameFrameStageName, context: GameFrameContext): void {
    const handlers = this.stageHandlers[stage];
    for (let i = 0; i < handlers.length; i += 1) {
      const handler = handlers[i];
      if (!handler) {
        continue;
      }
      handler(context);
    }

    if (this.stageCompactionNeeded[stage]) {
      this.compactStageHandlers(stage);
    }
  }

  private compactStageHandlers(stage: GameFrameStageName): void {
    const handlers = this.stageHandlers[stage];
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < handlers.length; readIndex += 1) {
      const handler = handlers[readIndex];
      if (handler) {
        handlers[writeIndex] = handler;
        writeIndex += 1;
      }
    }
    handlers.length = writeIndex;
    this.stageCompactionNeeded[stage] = false;
  }

  get time(): number {
    return this.timeMs;
  }

  get frameNumber(): number {
    return this.frame;
  }
}
