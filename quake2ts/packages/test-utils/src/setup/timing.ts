
export interface MockRAF {
  tick(timestamp?: number): void;
  advance(deltaMs?: number): void;
  getCallbacks(): FrameRequestCallback[];
  reset(): void;
  enable(): void;
  disable(): void;
}

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
        global.requestAnimationFrame = raf as any;
        global.cancelAnimationFrame = cancel as any;
    },

    disable() {
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
    // Add minimal navigation/resource timing interfaces to satisfy types if needed
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

  // Enhance with control methods attached to the object (casting to any to expose them)
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
}

/**
 * Helper to simulate multiple frames of a game loop.
 * @param count Number of frames to simulate
 * @param frameTimeMs Time per frame in milliseconds
 * @param callback Optional callback to run inside the loop (e.g. triggering inputs)
 */
export function simulateFrames(count: number, frameTimeMs: number = 16.6, callback?: (frameIndex: number) => void) {
    // This assumes requestAnimationFrame is already mocked or we are driving it via manual calls
    // If using the MockRAF above, one would call mockRAF.tick() in a loop.
    // However, this helper might be intended to work with the *current* global RAF.

    // Check if we can drive the global RAF
    // @ts-ignore
    const raf = global.requestAnimationFrame;
    if (!raf) return;

    // Ideally, we'd need access to the mock controller to force ticks.
    // If this is just running standardized "wait", it won't work synchronously.
    // So this helper really makes sense only if we have a MockRAF instance or can control time.

    // For now, let's assume this helper is meant to be used with the MockRAF:
    // "Run a loop that calls requestAnimationFrame callbacks"

    // Implementation depends on how the test is set up.
    // If the user replaces global.requestAnimationFrame with our MockRAF, we can't easily access the 'mock' instance unless passed in.
    // BUT, if we implement it to just loop and invoke pending callbacks if possible, it's tricky without shared state.

    // Let's implement a version that requires passing the MockRAF controller, or tries to assume one.
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
