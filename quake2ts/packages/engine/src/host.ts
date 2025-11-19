import {
  FixedTimestepLoop,
  type FixedStepContext,
  type LoopOptions,
  type RenderContext,
} from './loop.js';

export interface GameFrameResult<FrameState = unknown> {
  readonly frame: number;
  readonly timeMs: number;
  readonly state?: FrameState;
}

export interface GameSimulation<FrameState = unknown> {
  init(startTimeMs: number): GameFrameResult<FrameState> | void;
  frame(step: FixedStepContext): GameFrameResult<FrameState>;
  shutdown(): void;
}

export interface GameRenderSample<FrameState = unknown> extends RenderContext {
  readonly previous?: GameFrameResult<FrameState>;
  readonly latest?: GameFrameResult<FrameState>;
}

export interface ClientRenderer<FrameState = unknown> {
  init(initial?: GameFrameResult<FrameState>): void;
  render(sample: GameRenderSample<FrameState>): void;
  shutdown(): void;
}

export interface EngineHostOptions {
  readonly loop?: Partial<LoopOptions>;
  readonly startTimeMs?: number;
}

export class EngineHost<FrameState = unknown> {
  private readonly loop: FixedTimestepLoop;
  private readonly startTimeMs: number;
  private previousFrame?: GameFrameResult<FrameState>;
  private latestFrame?: GameFrameResult<FrameState>;
  private started = false;

  constructor(
    private readonly game: GameSimulation<FrameState>,
    private readonly client?: ClientRenderer<FrameState>,
    options: EngineHostOptions = {},
  ) {
    const now = options.loop?.now?.() ?? Date.now();
    this.startTimeMs = options.startTimeMs ?? options.loop?.startTimeMs ?? now;
    this.loop = new FixedTimestepLoop(
      {
        simulate: this.stepSimulation,
        render: this.renderClient,
      },
      { ...options.loop, startTimeMs: this.startTimeMs },
    );
  }

  start(): void {
    if (this.started) return;

    this.latestFrame = this.game.init(this.startTimeMs) ?? this.latestFrame;
    this.client?.init(this.latestFrame);

    this.started = true;
    this.loop.start();
  }

  stop(): void {
    if (!this.started) return;

    this.loop.stop();
    this.client?.shutdown();
    this.game.shutdown();
    this.previousFrame = undefined;
    this.latestFrame = undefined;
    this.started = false;
  }

  pump(elapsedMs: number): void {
    this.loop.pump(elapsedMs);
  }

  getLatestFrame(): GameFrameResult<FrameState> | undefined {
    return this.latestFrame;
  }

  isRunning(): boolean {
    return this.loop.isRunning();
  }

  private stepSimulation = (step: FixedStepContext): void => {
    this.previousFrame = this.latestFrame;
    this.latestFrame = this.game.frame(step);
  };

  private renderClient = (renderContext: RenderContext): void => {
    if (!this.client) return;
    this.client.render({
      ...renderContext,
      previous: this.previousFrame,
      latest: this.latestFrame,
    });
  };
}
