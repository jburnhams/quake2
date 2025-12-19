
export interface MockRAF {
  tick(timestamp?: number): void;
  advance(deltaMs?: number): void;
  getCallbacks(): FrameRequestCallback[];
  reset(): void;
  enable(): void;
  disable(): void;
}

let activeMockRAF: MockRAF | undefined;

/**
 * Creates a mock implementation of requestAnimationFrame that allows manual control.
 * It replaces the global requestAnimationFrame and cancelAnimationFrame.
 */
export function createMockRAF(): MockRAF {
  let callbacks: { id: number; callback: FrameRequestCallback }[] = [];
  let nextId = 1;
  let currentTime = 0;

  const originalRAF = global.requestAnimationFrame;
  const originalCancelRAF = global.cancelAnimationFrame;

  const raf = (callback: FrameRequestCallback): number => {
    const id = nextId++;
    callbacks.push({ id, callback });
    return id;
  };

  const cancel = (id: number): void => {
    callbacks = callbacks.filter(cb => cb.id !== id);
  };

  const mock: MockRAF = {
    tick(timestamp?: number) {
      if (typeof timestamp !== 'number') {
        currentTime += 16.6; // Default to ~60fps
      } else {
        currentTime = timestamp;
      }

      const currentCallbacks = [...callbacks];
      callbacks = []; // Clear before execution so new RAFs go to next frame

      currentCallbacks.forEach(({ callback }) => {
        callback(currentTime);
      });
    },

    advance(deltaMs: number = 16.6) {
      this.tick(currentTime + deltaMs);
    },

    getCallbacks() {
      return callbacks.map(c => c.callback);
    },

    reset() {
      callbacks = [];
      nextId = 1;
      currentTime = 0;
    },

    enable() {
        activeMockRAF = this;
        global.requestAnimationFrame = raf as any;
        global.cancelAnimationFrame = cancel as any;
    },

    disable() {
        if (activeMockRAF === this) {
            activeMockRAF = undefined;
        }

        if (originalRAF) {
            global.requestAnimationFrame = originalRAF;
        } else {
            // @ts-ignore
            delete global.requestAnimationFrame;
        }

        if (originalCancelRAF) {
            global.cancelAnimationFrame = originalCancelRAF;
        } else {
             // @ts-ignore
            delete global.cancelAnimationFrame;
        }
    }
  };

  return mock;
}

/**
 * Creates a mock Performance object with controllable time.
 */
export function createMockPerformance(startTime: number = 0): Performance {
  let currentTime = startTime;

  const mockPerf = {
    now: () => currentTime,
    timeOrigin: startTime,
    timing: {
      navigationStart: startTime,
    },
    clearMarks: () => {},
    clearMeasures: () => {},
    clearResourceTimings: () => {},
    getEntries: () => [],
    getEntriesByName: () => [],
    getEntriesByType: () => [],
    mark: () => {},
    measure: () => {},
    setResourceTimingBufferSize: () => {},
    toJSON: () => ({}),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as Performance;

  (mockPerf as any).advance = (deltaMs: number) => {
    currentTime += deltaMs;
  };
  (mockPerf as any).setTime = (time: number) => {
    currentTime = time;
  };

  return mockPerf;
}

export interface ControlledTimer {
  tick(): void;
  advanceBy(ms: number): void;
  clear(): void;
  restore(): void;
}

/**
 * Creates a controlled timer that replaces global setTimeout/setInterval.
 * Allows deterministic time advancement.
 */
export function createControlledTimer(): ControlledTimer {
    let currentTime = 0;
    interface Timer {
        id: number;
        callback: Function;
        dueTime: number;
        interval?: number;
        args: any[];
    }
    let timers: Timer[] = [];
    let nextId = 1;

    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;

    const mockSetTimeout = (callback: Function, delay: number = 0, ...args: any[]) => {
        const id = nextId++;
        timers.push({ id, callback, dueTime: currentTime + delay, args });
        return id;
    };

    const mockClearTimeout = (id: any) => {
        timers = timers.filter(t => t.id !== id);
    };

    const mockSetInterval = (callback: Function, delay: number = 0, ...args: any[]) => {
        const id = nextId++;
        timers.push({ id, callback, dueTime: currentTime + delay, interval: delay, args });
        return id;
    };

    const mockClearInterval = (id: any) => {
        timers = timers.filter(t => t.id !== id);
    };

    global.setTimeout = mockSetTimeout as any;
    global.clearTimeout = mockClearTimeout as any;
    global.setInterval = mockSetInterval as any;
    global.clearInterval = mockClearInterval as any;

    return {
        tick() {
            this.advanceBy(0);
        },
        advanceBy(ms: number) {
            const targetTime = currentTime + ms;

            // Process timers until targetTime
            while (true) {
                // Find earliest timer
                let earliest: Timer | null = null;
                for (const t of timers) {
                    if (!earliest || t.dueTime < earliest.dueTime) {
                        earliest = t;
                    }
                }

                if (!earliest || earliest.dueTime > targetTime) {
                    break;
                }

                // Advance time to this timer
                currentTime = earliest.dueTime;

                // Execute
                const { callback, args, interval, id } = earliest;

                if (interval !== undefined) {
                    earliest.dueTime += interval;
                    // Prevent infinite loops with 0 interval
                    if (interval === 0) earliest.dueTime += 1;
                } else {
                    timers = timers.filter(t => t.id !== id);
                }

                callback(...args);
            }

            currentTime = targetTime;
        },
        clear() {
            timers = [];
        },
        restore() {
            global.setTimeout = originalSetTimeout;
            global.clearTimeout = originalClearTimeout;
            global.setInterval = originalSetInterval;
            global.clearInterval = originalClearInterval;
        }
    };
}

/**
 * Helper to simulate multiple frames of a game loop.
 * @param count Number of frames to simulate
 * @param frameTimeMs Time per frame in milliseconds
 * @param callback Optional callback to run inside the loop (e.g. triggering inputs)
 */
export function simulateFrames(count: number, frameTimeMs: number = 16.6, callback?: (frameIndex: number) => void) {
    if (!activeMockRAF) {
        throw new Error("simulateFrames requires an active MockRAF. Ensure createMockRAF().enable() is called.");
    }

    for (let i = 0; i < count; i++) {
        if (callback) callback(i);
        activeMockRAF.advance(frameTimeMs);
    }
}

/**
 * Simulates frames using a provided MockRAF controller.
 */
export function simulateFramesWithMock(mock: MockRAF, count: number, frameTimeMs: number = 16.6, callback?: (frameIndex: number) => void) {
    for (let i = 0; i < count; i++) {
        if (callback) callback(i);
        mock.advance(frameTimeMs);
    }
}
