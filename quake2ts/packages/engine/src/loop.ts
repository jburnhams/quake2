export interface FixedStepContext {
  readonly frame: number;
  readonly deltaMs: number;
  readonly nowMs: number;
}

export interface RenderContext {
  readonly alpha: number;
  readonly nowMs: number;
  readonly accumulatorMs: number;
  readonly frame: number;
}

export interface LoopCallbacks {
  simulate(step: FixedStepContext): void;
  render?(sample: RenderContext): void;
}

export interface LoopOptions {
  readonly fixedDeltaMs: number;
  readonly maxSubSteps: number;
  readonly maxDeltaMs: number;
  readonly startTimeMs?: number;
  readonly now: () => number;
  readonly schedule: (tick: () => void) => unknown;
}

const DEFAULT_FIXED_DELTA_MS = 25;
const DEFAULT_MAX_SUBSTEPS = 5;

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const defaultScheduler = (tick: () => void) => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => tick());
  } else {
    setTimeout(tick, DEFAULT_FIXED_DELTA_MS);
  }
};

export class FixedTimestepLoop {
  private readonly options: LoopOptions;
  private accumulatorMs = 0;
  private frame = 0;
  private lastTimeMs: number | undefined;
  private running = false;

  constructor(private readonly callbacks: LoopCallbacks, options: Partial<LoopOptions> = {}) {
    const fixedDeltaMs = options.fixedDeltaMs ?? DEFAULT_FIXED_DELTA_MS;
    const maxSubSteps = options.maxSubSteps ?? DEFAULT_MAX_SUBSTEPS;
    this.options = {
      fixedDeltaMs,
      maxSubSteps,
      maxDeltaMs: options.maxDeltaMs ?? fixedDeltaMs * maxSubSteps,
      startTimeMs: options.startTimeMs,
      now: options.now ?? defaultNow,
      schedule: options.schedule ?? defaultScheduler,
    } satisfies LoopOptions;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimeMs = this.options.startTimeMs ?? this.options.now();
    this.options.schedule(this.tick);
  }

  stop(): void {
    this.running = false;
  }

  pump(elapsedMs: number): void {
    const nowMs = (this.lastTimeMs ?? 0) + elapsedMs;
    this.lastTimeMs = nowMs;
    this.advance(elapsedMs, nowMs);
  }

  isRunning(): boolean {
    return this.running;
  }

  get frameNumber(): number {
    return this.frame;
  }

  private tick = (): void => {
    if (!this.running) return;

    const nowMs = this.options.now();
    const elapsed = this.lastTimeMs === undefined ? 0 : nowMs - this.lastTimeMs;
    this.lastTimeMs = nowMs;

    this.advance(elapsed, nowMs);

    if (this.running) {
      this.options.schedule(this.tick);
    }
  };

  private advance(elapsedMs: number, nowMs: number): void {
    const clampedDelta = Math.min(Math.max(elapsedMs, 0), this.options.maxDeltaMs);
    this.accumulatorMs = Math.min(
      this.accumulatorMs + clampedDelta,
      this.options.fixedDeltaMs * this.options.maxSubSteps,
    );

    let steps = 0;
    while (this.accumulatorMs >= this.options.fixedDeltaMs && steps < this.options.maxSubSteps) {
      this.frame += 1;
      this.callbacks.simulate({ frame: this.frame, deltaMs: this.options.fixedDeltaMs, nowMs });
      this.accumulatorMs -= this.options.fixedDeltaMs;
      steps += 1;
    }

    const alpha = this.options.fixedDeltaMs === 0 ? 0 : this.accumulatorMs / this.options.fixedDeltaMs;
    this.callbacks.render?.({ alpha, nowMs, accumulatorMs: this.accumulatorMs, frame: this.frame });
  }
}
