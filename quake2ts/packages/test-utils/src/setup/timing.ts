export interface MockRAF {
  /**
   * Run one frame manually.
   * @param time Timestamp to pass to the callback (defaults to incrementing by 16ms)
   */
  tick(time?: number): void;

  /**
   * Advance multiple frames.
   * @param count Number of frames
   * @param frameTime Time per frame in ms (default 16)
   */
  advance(count: number, frameTime?: number): void;

  /**
   * Get list of currently registered callbacks.
   */
  getCallbacks(): Array<{id: number, callback: FrameRequestCallback}>;

  /**
   * Reset the internal state.
   */
  reset(): void;

  enable(): void;
  disable(): void;
}

/**
 * Creates a mock RequestAnimationFrame implementation.
 * It replaces the global requestAnimationFrame/cancelAnimationFrame
 * with a controlled version.
 */
export function createMockRAF(): MockRAF {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  let lastTime = 0;

  const originalRAF = global.requestAnimationFrame;
  const originalCancelRAF = global.cancelAnimationFrame;

  const mockReqRAF = (callback: FrameRequestCallback): number => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  };

  const mockCancelRAF = (id: number): void => {
    callbacks.delete(id);
  };

  // Auto-enable if global is undefined? Or wait for enable()?
  // The test calls enable(), so we should respect that.
  // But our previous implementation set global immediately.
  // Let's change behavior to only set on enable(), or set immediately but allow disable/enable.

  // To match previous implementation behavior (which replaced immediately):
  global.requestAnimationFrame = mockReqRAF;
  global.cancelAnimationFrame = mockCancelRAF;

  const mockRAF: MockRAF = {
    tick(time?: number) {
      if (time === undefined) {
        lastTime += 16;
        time = lastTime;
      } else {
        lastTime = time;
      }

      const currentCallbacks = Array.from(callbacks.entries());
      callbacks.clear();

      currentCallbacks.forEach(([_, callback]) => {
        callback(time!);
      });
    },

    advance(count: number, frameTime: number = 16) {
      for (let i = 0; i < count; i++) {
        this.tick(lastTime + frameTime);
      }
    },

    getCallbacks() {
      return Array.from(callbacks.entries()).map(([id, callback]) => ({id, callback}));
    },

    reset() {
      callbacks.clear();
      nextId = 1;
      lastTime = 0;
    },

    enable() {
      global.requestAnimationFrame = mockReqRAF;
      global.cancelAnimationFrame = mockCancelRAF;
    },

    disable() {
      if (originalRAF) global.requestAnimationFrame = originalRAF;
      if (originalCancelRAF) global.cancelAnimationFrame = originalCancelRAF;
    }
  };

  return mockRAF;
}

/**
 * Mocks the Performance API.
 */
export function createMockPerformance(startTime: number = 0): Performance {
  let now = startTime;

  return {
    now: () => now,
    timeOrigin: startTime,
    // Add fake navigation/timing props as needed
    timing: {
      navigationStart: startTime
    },
    // Mock methods to update time
    __advance: (ms: number) => { now += ms; },
    __set: (ms: number) => { now = ms; },

    // Stub other methods
    mark: () => {},
    measure: () => {},
    getEntries: () => [],
    getEntriesByName: () => [],
    getEntriesByType: () => [],
    clearMarks: () => {},
    clearMeasures: () => {},
    clearResourceTimings: () => {},
    setResourceTimingBufferSize: () => {},
    onresourcetimingbufferfull: null,
    toJSON: () => ({})
  } as unknown as Performance;
}

export interface ControlledTimer {
  tick(): void;
  advanceBy(ms: number): void;
  clear(): void;
  restore(): void;
}

/**
 * A helper to simulate passing time using mocked timers (setTimeout/setInterval).
 * Requires using vi.useFakeTimers() or similar provided by test runner separately,
 * or this can implement a custom loop if we were replacing global.setTimeout.
 */
export function createControlledTimer(): ControlledTimer {
  // Simple priority queue for timers
  interface Timer {
    id: number;
    callback: Function;
    dueTime: number;
    interval?: number;
    args: any[];
  }

  let currentTime = 0;
  let nextId = 1;
  const timers: Timer[] = [];

  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;

  global.setTimeout = ((callback: Function, delay: number = 0, ...args: any[]): any => {
    const id = nextId++;
    timers.push({
      id,
      callback,
      dueTime: currentTime + delay,
      args
    });
    timers.sort((a, b) => a.dueTime - b.dueTime);
    return id as any;
  }) as typeof global.setTimeout;

  global.clearTimeout = (id: any) => {
    const idx = timers.findIndex(t => t.id === Number(id));
    if (idx !== -1) timers.splice(idx, 1);
  };

  global.setInterval = ((callback: Function, delay: number = 0, ...args: any[]): any => {
    const id = nextId++;
    const timer: Timer = {
      id,
      callback,
      dueTime: currentTime + delay,
      interval: delay,
      args
    };
    timers.push(timer);
    timers.sort((a, b) => a.dueTime - b.dueTime);
    return id as any;
  }) as typeof global.setInterval;

  global.clearInterval = (id: any) => {
    const idx = timers.findIndex(t => t.id === Number(id));
    if (idx !== -1) timers.splice(idx, 1);
  };

  const restore = () => {
      timers.length = 0;
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
  };

  return {
    tick() {
      // Process all timers due *now* (at currentTime)
      this.advanceBy(0);
    },
    advanceBy(ms: number) {
      currentTime += ms;
      while (timers.length > 0 && timers[0].dueTime <= currentTime) {
        const timer = timers.shift()!;
        timer.callback(...timer.args);

        if (timer.interval !== undefined) {
          // Re-schedule interval
          timer.dueTime += timer.interval;
          // If the interval is very short, ensure we don't loop forever in one advance
          if (timer.dueTime <= currentTime) {
              // For simplicity in this mock, catch up to current time or just schedule next
              // Real browsers might throttle. We'll just schedule next.
             timer.dueTime = Math.max(timer.dueTime, currentTime + 1);
          }
          timers.push(timer);
          timers.sort((a, b) => a.dueTime - b.dueTime);
        }
      }
    },
    clear: restore,
    restore
  };
}

/**
 * Helper to simulate multiple animation frames.
 */
export function simulateFrames(count: number, frameTime: number = 16, callback?: (frameIndex: number) => void) {
  let now = Date.now();
  for (let i = 0; i < count; i++) {
    now += frameTime;
    if (callback) callback(i);
  }
}

export function simulateFramesWithMock(mockRAF: MockRAF, count: number, frameTime: number = 16.6, callback?: (frameIndex: number) => void) {
    mockRAF.enable();
    for(let i=0; i<count; i++) {
        // Assume app calls RAF
        if (callback) {
            requestAnimationFrame(() => callback(i));
        }
        mockRAF.tick();
    }
}
