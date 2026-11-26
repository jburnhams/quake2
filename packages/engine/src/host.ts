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
  frame(step: FixedStepContext, command?: any): GameFrameResult<FrameState>;
  shutdown(): void;
}

export interface GameRenderSample<FrameState = unknown> extends RenderContext {
  readonly previous?: GameFrameResult<FrameState>;
  readonly latest?: GameFrameResult<FrameState>;
}

import { UserCommand } from '@quake2ts/shared';
import { Camera } from './render/camera.js';
import { CommandRegistry } from './commands.js';
import { CvarRegistry } from './cvars.js';

export interface ClientRenderer<FrameState = unknown> {
  init(initial?: GameFrameResult<FrameState>): void;
  render(sample: GameRenderSample<FrameState>): any;
  shutdown(): void;
  camera?: Camera;
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
  private paused_ = false;
  private latestCommand?: UserCommand;
  readonly commands = new CommandRegistry();
  readonly cvars = new CvarRegistry();

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

    // Wire up cvar autocomplete provider
    this.commands.registerAutocompleteProvider(() => {
      return this.cvars.list().map(cvar => cvar.name);
    });
  }

  start(): void {
    if (this.started) return;

    try {
      this.latestFrame = this.game.init(this.startTimeMs) ?? this.latestFrame;
      this.client?.init(this.latestFrame);
    } catch (error) {
      this.game.shutdown();
      this.client?.shutdown();
      throw error;
    }

    this.started = true;
    this.paused_ = false;
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
    this.paused_ = false;
  }

  setPaused(paused: boolean): void {
    this.paused_ = paused;
    if (paused) {
      this.loop.stop();
    } else if (this.started) {
      this.loop.start();
    }
  }

  get paused(): boolean {
    return this.paused_;
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
    this.latestFrame = this.game.frame(step, this.latestCommand);
  };

  private renderClient = (renderContext: RenderContext): void => {
    if (!this.client) return;

    this.latestCommand = this.client.render({
      ...renderContext,
      previous: this.previousFrame,
      latest: this.latestFrame,
    });
  };
}
