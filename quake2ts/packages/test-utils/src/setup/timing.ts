export interface MockRAF {
    tick(ms?: number): void;
    advance(ms: number): void;
    getCallbacks(): FrameRequestCallback[];
    reset(): void;
    enable(): void;
    disable(): void;
}

/**
 * Creates a controllable requestAnimationFrame mock.
 * Note: If using `setupBrowserEnvironment`, it installs a basic setTimeout-based RAF.
 * This helper provides more manual control.
 */
export function createMockRAF(): MockRAF {
    let callbacks: Map<number, FrameRequestCallback> = new Map();
    let nextId = 1;
    let currentTime = 0;
    let originalRAF: any = undefined;
    let originalCancelRAF: any = undefined;

    const mock: MockRAF = {
        tick(ms: number = 16.66) {
            mock.advance(ms);
        },
        advance(ms: number) {
            currentTime += ms;
            const currentCallbacks = Array.from(callbacks.values());
            callbacks.clear();
            currentCallbacks.forEach(cb => cb(currentTime));
        },
        getCallbacks() {
            return Array.from(callbacks.values());
        },
        reset() {
            callbacks.clear();
            currentTime = 0;
            if (originalRAF) {
                global.requestAnimationFrame = originalRAF;
                global.cancelAnimationFrame = originalCancelRAF;
                originalRAF = undefined;
            }
        },
        enable() {
             if (typeof global !== 'undefined') {
                if (!originalRAF) {
                    originalRAF = global.requestAnimationFrame;
                    originalCancelRAF = global.cancelAnimationFrame;
                }
                global.requestAnimationFrame = (callback: FrameRequestCallback) => {
                    const id = nextId++;
                    callbacks.set(id, callback);
                    return id;
                };

                global.cancelAnimationFrame = (id: number) => {
                    callbacks.delete(id);
                };
            }
        },
        disable() {
             this.reset();
        }
    };

    return mock;
}

/**
 * Creates a mock Performance object.
 */
export function createMockPerformance(startTime: number = 0): Performance {
    let now = startTime;
    return {
        now: () => now,
        timeOrigin: startTime,
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
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        __advance: (ms: number) => { now += ms; }
    } as unknown as Performance;
}

export interface ControlledTimer {
    tick(): void;
    advanceBy(ms: number): void;
    clear(): void;
    restore(): void;
}

/**
 * Creates a controlled timer environment using vi.useFakeTimers (if available).
 * This wrapper abstracts the test runner specific timer logic.
 */
export function createControlledTimer(): ControlledTimer {
    let vi: any;
    try {
         // @ts-ignore
         vi = global.vi;
         if (!vi) {
             // Try dynamic import for vitest if not global
             // But we can't do async inside this sync function
             // So we assume global.vi is available in vitest environment
         }
    } catch (e) {}

    // Check if we can find it on arguments.callee? No.
    // In vitest environment, 'vi' should be available if configured, or imported.
    // The test file imports 'vi' from 'vitest'.
    // If we want this helper to work, we might need to pass 'vi' instance or rely on global.
    // Let's assume global.vi might not be set by default in all environments.

    // For now, if we can't find vi, we'll try to find jest (if migrated) or just fail.
    // Let's explicitly look for global.vi

    if (typeof global !== 'undefined' && (global as any).vi) {
        vi = (global as any).vi;
    }

    if (vi) {
        vi.useFakeTimers();
        return {
            tick: () => vi.advanceTimersByTime(16),
            advanceBy: (ms: number) => vi.advanceTimersByTime(ms),
            clear: () => vi.clearAllTimers(),
            restore: () => vi.useRealTimers()
        };
    }

    // Fallback if no vitest
    console.warn('createControlledTimer: vitest not found, timers will not be controlled.');
    return {
        tick: () => {},
        advanceBy: () => {},
        clear: () => {},
        restore: () => {}
    };
}

/**
 * Simulates running a loop for a number of frames.
 */
export function simulateFrames(count: number, frameTime: number = 16, callback?: (frameIndex: number) => void): void {
    for (let i = 0; i < count; i++) {
        if (callback) callback(i);
        // Best effort to advance timers if they are mocked
        try {
            // @ts-ignore
            if (global.vi) global.vi.advanceTimersByTime(frameTime);
        } catch(e) {}
    }
}

/**
 * Helper to simulate frames specifically using a MockRAF instance.
 */
export function simulateFramesWithMock(mockRAF: MockRAF, count: number, frameTime: number = 16.6, callback?: (frameIndex: number) => void) {
    for (let i = 0; i < count; i++) {
        mockRAF.advance(frameTime);
        if (callback) callback(i);
    }
}
