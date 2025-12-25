export interface MockRAF {
  tick(time?: number): void;
  advance(delta: number): void;
  getCallbacks(): number;
}

export interface ControlledTimer {
  tick(): void;
  advanceBy(ms: number): void;
  clear(): void;
}

/**
 * Creates a mock implementation of requestAnimationFrame.
 */
export function createMockRAF(): MockRAF {
  let callbacks: { id: number; callback: FrameRequestCallback }[] = [];
  let nextId = 1;
  let now = 0;

  const raf = (callback: FrameRequestCallback): number => {
    const id = nextId++;
    callbacks.push({ id, callback });
    return id;
  };

  const cancel = (id: number): void => {
    callbacks = callbacks.filter((cb) => cb.id !== id);
  };

  global.requestAnimationFrame = raf;
  global.cancelAnimationFrame = cancel;

  const mock = {
    tick(time?: number) {
      if (typeof time === 'number') {
          now = time;
      } else {
          now += 16; // Advance by ~1 frame
      }
      const currentCallbacks = [...callbacks];
      callbacks = []; // Clear before executing to allow re-scheduling
      currentCallbacks.forEach((cb) => cb.callback(now));
    },
    advance(delta: number) {
      now += delta;
      this.tick(now);
    },
    getCallbacks() {
      return callbacks.length;
    },
  };

  (global.requestAnimationFrame as any).__mock__ = mock;

  return mock;
}

/**
 * Creates a mock implementation of the Performance API.
 */
export function createMockPerformance(startTime = 0): Performance {
  let now = startTime;

  const mockPerformance = {
    now: () => now,
    timeOrigin: Date.now(),
    timing: {
      navigationStart: Date.now(),
    },
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
    toJSON: () => ({}),
    __advance: (ms: number) => { now += ms; }
  } as unknown as Performance;

  global.performance = mockPerformance;

  return mockPerformance;
}

/**
 * Creates a controlled timer for setTimeout/setInterval.
 * Replaces global timers with a manually controlled implementation.
 */
export function createControlledTimer(): ControlledTimer {
  let currentTime = 0;

  interface TimerTask {
      id: number;
      callback: Function;
      time: number;
      args: any[];
      type: 'timeout' | 'interval';
      interval?: number;
  }

  let tasks: TimerTask[] = [];
  let nextId = 1;

  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;

  // Use explicit 'any' or correct types to satisfy TypeScript strict checks
  // NodeJS vs Browser types can be tricky. We use 'any' to match common usage in mocks.
  global.setTimeout = ((callback: Function | string, ms: number = 0, ...args: any[]): any => {
    const cb = typeof callback === 'string' ? () => { eval(callback); } : callback;
    const id = nextId++;
    tasks.push({ id, callback: cb, time: currentTime + ms, args, type: 'timeout' });
    tasks.sort((a, b) => a.time - b.time);
    return id as any;
  }) as any;

  global.clearTimeout = ((id: any): void => {
    tasks = tasks.filter((t) => t.id !== id);
  }) as any;

  global.setInterval = ((callback: Function | string, ms: number = 0, ...args: any[]): any => {
      const cb = typeof callback === 'string' ? () => { eval(callback); } : callback;
      const id = nextId++;
      tasks.push({ id, callback: cb, time: currentTime + ms, args, type: 'interval', interval: ms });
      tasks.sort((a, b) => a.time - b.time);
      return id as any;
  }) as any;

  global.clearInterval = ((id: any): void => {
      tasks = tasks.filter((t) => t.id !== id);
  }) as any;

  return {
    tick() {
      this.advanceBy(0);
    },
    advanceBy(ms: number) {
      currentTime += ms;

      let executionCount = 0;
      const MAX_EXECUTIONS = 10000;

      while (true) {
          if (tasks.length === 0) break;
          const nextTask = tasks[0];
          if (nextTask.time > currentTime) break;

          if (executionCount++ > MAX_EXECUTIONS) {
              console.warn('ControlledTimer: Exceeded maximum execution count in advanceBy. Possible infinite loop with 0-delay interval.');
              break;
          }

          tasks.shift();

          nextTask.callback(...nextTask.args);

          if (nextTask.type === 'interval') {
              nextTask.time += nextTask.interval!;
              if (nextTask.interval === 0) {
                  // Prevent infinite loop if interval is 0
                  // We rely on MAX_EXECUTIONS to catch this eventually
              }
              tasks.push(nextTask);
              tasks.sort((a, b) => a.time - b.time);
          }
      }
    },
    clear() {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
      tasks = [];
    }
  };
}

/**
 * Simulates multiple frames using requestAnimationFrame.
 * If createMockRAF was used, this helper will interact with it properly.
 */
export function simulateFrames(count: number, frameTime = 16, callback?: () => void) {
  const rafMock = (global.requestAnimationFrame as any)?.__mock__ as MockRAF | undefined;

  for (let i = 0; i < count; i++) {
    if ((global.performance as any)?.__advance) {
        (global.performance as any).__advance(frameTime);
    }

    if (rafMock) {
        rafMock.advance(frameTime);
    }

    if (callback) callback();
  }
}
