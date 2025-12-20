
// Basic mock of AudioContext
export function createMockAudioContext(): AudioContext {
    const context = {
        createGain: () => ({
            connect: () => {},
            gain: { value: 1, setValueAtTime: () => {} }
        }),
        createOscillator: () => ({
            connect: () => {},
            start: () => {},
            stop: () => {},
            frequency: { value: 440 }
        }),
        createBufferSource: () => ({
            connect: () => {},
            start: () => {},
            stop: () => {},
            buffer: null,
            playbackRate: { value: 1 },
            loop: false
        }),
        destination: {},
        currentTime: 0,
        state: 'running',
        resume: async () => {},
        suspend: async () => {},
        close: async () => {},
        decodeAudioData: async (buffer: ArrayBuffer) => ({
            duration: 1,
            length: 44100,
            sampleRate: 44100,
            numberOfChannels: 2,
            getChannelData: () => new Float32Array(44100)
        }),
        createBuffer: (channels: number, length: number, sampleRate: number) => ({
            duration: length / sampleRate,
            length,
            sampleRate,
            numberOfChannels: channels,
            getChannelData: () => new Float32Array(length)
        }),
        // Helper to track events if needed
        _events: [] as AudioEvent[]
    };

    // Proxy to capture events
    return new Proxy(context as unknown as AudioContext, {
        get(target, prop, receiver) {
             if (prop === '_events') return (target as any)._events;
             const value = Reflect.get(target, prop, receiver);
             if (typeof value === 'function') {
                 return (...args: any[]) => {
                     (target as any)._events.push({ type: String(prop), args });
                     return Reflect.apply(value, target, args);
                 };
             }
             return value;
        }
    });
}

/**
 * Replaces the global AudioContext with a mock.
 */
export function setupMockAudioContext() {
    if (typeof global.AudioContext === 'undefined' && typeof global.window !== 'undefined') {
        // @ts-ignore
        global.AudioContext = class {
            constructor() {
                return createMockAudioContext();
            }
        };
        // @ts-ignore
        global.window.AudioContext = global.AudioContext;
        // @ts-ignore
        global.window.webkitAudioContext = global.AudioContext;
    }
}

/**
 * Restores the original AudioContext (if it was mocked).
 */
export function teardownMockAudioContext() {
    // If we mocked it on global, we might want to remove it.
    // However, usually in JSDOM it doesn't exist, so we just leave it or delete it.
    // @ts-ignore
    if (global.AudioContext && global.AudioContext.toString().includes('class')) {
         // @ts-ignore
        delete global.AudioContext;
         // @ts-ignore
        delete global.window.AudioContext;
         // @ts-ignore
        delete global.window.webkitAudioContext;
    }
}

export interface AudioEvent {
    type: string;
    args: any[];
}

/**
 * Captures audio operations for verification.
 * Note: Only works if the context was created via createMockAudioContext which proxies calls.
 */
export function captureAudioEvents(context: AudioContext): AudioEvent[] {
    return (context as any)._events || [];
}
