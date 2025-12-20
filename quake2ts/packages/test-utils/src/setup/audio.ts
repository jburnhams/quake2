export function setupMockAudioContext() {
    // Mock AudioContext and related classes if not already mocked
    if (typeof global.AudioContext === 'undefined') {
        global.AudioContext = class MockAudioContext {
            state = 'suspended';
            currentTime = 0;
            destination = {};
            listener = { positionX: { value: 0 }, positionY: { value: 0 }, positionZ: { value: 0 }, forwardX: { value: 0 }, forwardY: { value: 0 }, forwardZ: { value: 0 }, upX: { value: 0 }, upY: { value: 0 }, upZ: { value: 0 } };
            sampleRate = 44100;
            // Internal event log
            __events: AudioEvent[] = [];

            createGain() {
                this.__events.push({ type: 'createGain', args: [], time: this.currentTime });
                return { gain: { value: 1, linearRampToValueAtTime: () => {} }, connect: () => {}, disconnect: () => {} };
            }
            createBuffer() {
                this.__events.push({ type: 'createBuffer', args: [], time: this.currentTime });
                return { duration: 1, length: 1, sampleRate: 44100, getChannelData: () => new Float32Array(1) };
            }
            createBufferSource() {
                this.__events.push({ type: 'createBufferSource', args: [], time: this.currentTime });
                return { buffer: null, loop: false, playbackRate: { value: 1 }, start: () => {}, stop: () => {}, connect: () => {}, disconnect: () => {}, onended: null };
            }
            createPanner() {
                this.__events.push({ type: 'createPanner', args: [], time: this.currentTime });
                return { setPosition: () => {}, setOrientation: () => {}, connect: () => {}, disconnect: () => {} };
            }
            createDynamicsCompressor() {
                this.__events.push({ type: 'createDynamicsCompressor', args: [], time: this.currentTime });
                return { connect: () => {}, disconnect: () => {} };
            }
            createAnalyser() {
                this.__events.push({ type: 'createAnalyser', args: [], time: this.currentTime });
                return { connect: () => {}, disconnect: () => {}, getByteFrequencyData: () => {}, getFloatFrequencyData: () => {} };
            }
            decodeAudioData(data: ArrayBuffer) { return Promise.resolve({ duration: 1, length: 1, sampleRate: 44100, numberOfChannels: 2 } as AudioBuffer); }
            resume() { this.state = 'running'; return Promise.resolve(); }
            suspend() { this.state = 'suspended'; return Promise.resolve(); }
            close() { this.state = 'closed'; return Promise.resolve(); }
        } as unknown as typeof AudioContext;

        // Also mock webkitAudioContext if needed
        // @ts-ignore
        global.webkitAudioContext = global.AudioContext;
    }
}

export function createMockAudioContext(): AudioContext {
    setupMockAudioContext();
    return new AudioContext();
}

export function teardownMockAudioContext() {
    // @ts-ignore
    delete global.AudioContext;
    // @ts-ignore
    delete global.webkitAudioContext;
}

export interface AudioEvent {
    type: string;
    args: any[];
    time: number;
}

/**
 * Captures audio events from a context.
 * The context must be created via setupMockAudioContext (MockAudioContext).
 */
export function captureAudioEvents(context: AudioContext): AudioEvent[] {
    // Check if context has __events property
    if ((context as any).__events) {
        return (context as any).__events;
    }
    return [];
}
