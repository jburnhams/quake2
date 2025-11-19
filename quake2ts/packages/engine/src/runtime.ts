import type { EngineExports } from './index.js';
import { EngineHost, type ClientRenderer, type EngineHostOptions, type GameFrameResult, type GameSimulation } from './host.js';

export class EngineRuntime<FrameState = unknown> {
  private started = false;

  constructor(private readonly engine: EngineExports, private readonly host: EngineHost<FrameState>) {}

  start(): void {
    if (this.started) return;
    this.engine.init();
    this.host.start();
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    this.host.stop();
    this.engine.shutdown();
    this.started = false;
  }

  pump(elapsedMs: number): void {
    this.host.pump(elapsedMs);
  }

  getLatestFrame(): GameFrameResult<FrameState> | undefined {
    return this.host.getLatestFrame();
  }

  isRunning(): boolean {
    return this.started && this.host.isRunning();
  }
}

export function createEngineRuntime<FrameState = unknown>(
  engine: EngineExports,
  game: GameSimulation<FrameState>,
  client?: ClientRenderer<FrameState>,
  options?: EngineHostOptions,
): EngineRuntime<FrameState> {
  return new EngineRuntime(engine, new EngineHost(game, client, options));
}
