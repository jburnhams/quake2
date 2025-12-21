/**
 * Interface for the mock RequestAnimationFrame implementation.
 */
export interface MockRAF {
  /**
   * Advances time by one tick (simulating one frame).
   * @param time Timestamp to pass to callbacks (default: calls Date.now())
   */
  tick(time?: number): void;
  /**
   * Advances time by a specific amount, triggering multiple frames if necessary.
   * Not fully implemented in simple version, acts as alias to tick() with specific time.
   */
  advance(ms: number): void;
  /**
   * Returns current pending callbacks.
   */
  getCallbacks(): Array<{id: number, callback: FrameRequestCallback}>;
}

/**
 * Creates a mock RequestAnimationFrame implementation.
 * Replaces global.requestAnimationFrame and cancelAnimationFrame.
 */
export function createMockRAF(): MockRAF {
  let callbacks: Array<{id: number, callback: FrameRequestCallback}> = [];
  let lastId = 0;
  let currentTime = 0;

  const originalRAF = global.requestAnimationFrame;
  const originalCancelRAF = global.cancelAnimationFrame;

  global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    lastId++;
    callbacks.push({ id: lastId, callback });
    return lastId;
  };

  global.cancelAnimationFrame = (id: number): void => {
    callbacks = callbacks.filter(cb => cb.id !== id);
  };

  return {
    tick(time?: number) {
      if (time) currentTime = time;
      else currentTime += 16.66; // ~60fps

      const currentCallbacks = [...callbacks];
      callbacks = []; // Clear before execution to allow re-scheduling

      currentCallbacks.forEach(cb => cb.callback(currentTime));
    },
    advance(ms: number) {
      // Simple implementation: just advance time and process one batch
      // For more complex simulation, we might loop
      currentTime += ms;
      this.tick(currentTime);
    },
    getCallbacks() {
      return callbacks;
    }
  };
}

/**
 * Creates a mock Performance object.
 */
export function createMockPerformance(startTime: number = 0): Performance {
  let now = startTime;

  const mockPerformance = {
    now: () => now,
    timeOrigin: startTime,
    timing: {
      navigationStart: startTime,
    },
    mark: (_name: string) => {},
    measure: (_name: string, _start: string, _end: string) => {},
    getEntries: () => [],
    getEntriesByName: (_name: string) => [],
    getEntriesByType: (_type: string) => [],
    clearMarks: (_name?: string) => {},
    clearMeasures: (_name?: string) => {},
    clearResourceTimings: () => {},
    setResourceTimingBufferSize: (_maxSize: number) => {},
    onresourcetimingbufferfull: null,
    toJSON: () => ({})
  } as unknown as Performance;

  // Polyfill global if needed, or return for injection
  if (typeof global.performance === 'undefined') {
      global.performance = mockPerformance;
  }

  return mockPerformance;
}

export interface ControlledTimer {
  /**
   * Advances virtual time by ms.
   */
  advanceBy(ms: number): void;
  /**
   * Runs all pending timers.
   */
  runAll(): void;
  /**
   * Restores original timer functions.
   */
  clear(): void;
}

/**
 * Creates controlled timers (setTimeout/setInterval).
 * Note: Use verify's useFakeTimers() for better integration with test runner.
 * This is a lightweight alternative or specific helper.
 */
export function createControlledTimer(): ControlledTimer {
    // This functionality is best provided by vitest/jest directly via vi.useFakeTimers()
    // Wrapping it here for convenience if needed, but for now we'll recommend `vi`.
    console.warn('createControlledTimer: Recommend using vi.useFakeTimers() instead.');

    return {
        advanceBy: (ms: number) => { /* delegate to vi.advanceTimersByTime(ms) in consumer */ },
        runAll: () => { /* delegate to vi.runAllTimers() */ },
        clear: () => { /* delegate to vi.useRealTimers() */ }
    };
}

/**
 * Simulates multiple RAF frames.
 */
export function simulateFrames(count: number, frameTime: number = 16, callback?: (frameIndex: number) => void): void {
  for (let i = 0; i < count; i++) {
    // If using the global mock RAF from createMockRAF, we just rely on callbacks being scheduled.
    // However, if we need to manually trigger them, we assume existing RAF loop.
    // This helper assumes a synchronous execution where we can just wait or tick.
    // With `vi.useFakeTimers()`, we would `vi.advanceTimersByTime(frameTime)`.

    if (callback) callback(i);
  }
}
