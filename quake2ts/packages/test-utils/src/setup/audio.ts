// Mock AudioContext and related interfaces
export function setupMockAudioContext() {
    class MockAudioNode {
        connect() { return this; }
        disconnect() {}
    }

    class MockGainNode extends MockAudioNode {
        gain = { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} };
    }

    class MockAudioBufferSourceNode extends MockAudioNode {
        buffer: any = null;
        loop = false;
        playbackRate = { value: 1 };
        start() {}
        stop() {}
    }

    class MockPannerNode extends MockAudioNode {
        positionX = { value: 0 };
        positionY = { value: 0 };
        positionZ = { value: 0 };
        setPosition(x: number, y: number, z: number) {
            this.positionX.value = x;
            this.positionY.value = y;
            this.positionZ.value = z;
        }
    }

    class MockAudioListener {
        positionX = { value: 0 };
        positionY = { value: 0 };
        positionZ = { value: 0 };
        forwardX = { value: 0 };
        forwardY = { value: 0 };
        forwardZ = { value: 0 };
        upX = { value: 0 };
        upY = { value: 0 };
        upZ = { value: 0 };

        setPosition(x: number, y: number, z: number) {
            this.positionX.value = x;
            this.positionY.value = y;
            this.positionZ.value = z;
        }
        setOrientation(fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) {
            this.forwardX.value = fx;
            this.forwardY.value = fy;
            this.forwardZ.value = fz;
            this.upX.value = ux;
            this.upY.value = uy;
            this.upZ.value = uz;
        }
    }

    class MockAudioContext {
        state = 'running';
        currentTime = 0;
        destination = new MockAudioNode();
        listener = new MockAudioListener();

        createGain() { return new MockGainNode(); }
        createBufferSource() { return new MockAudioBufferSourceNode(); }
        createPanner() { return new MockPannerNode(); }
        decodeAudioData(buffer: ArrayBuffer) {
            return Promise.resolve({
                duration: 1,
                numberOfChannels: 2,
                sampleRate: 44100,
                getChannelData: () => new Float32Array(100)
            });
        }
        resume() { return Promise.resolve(); }
        suspend() { return Promise.resolve(); }
        close() { return Promise.resolve(); }
    }

    // @ts-ignore
    global.AudioContext = MockAudioContext;
    // @ts-ignore
    global.webkitAudioContext = MockAudioContext;
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
    node?: any;
    args?: any[];
}

/**
 * Wraps the current AudioContext (mocked or real) to capture method calls.
 */
export function captureAudioEvents(context: AudioContext): AudioEvent[] {
    const events: AudioEvent[] = [];

    const methods = ['createGain', 'createBufferSource', 'createPanner', 'decodeAudioData'];
    methods.forEach(method => {
        const original = (context as any)[method];
        (context as any)[method] = function(...args: any[]) {
            events.push({ type: method, args });
            return original.apply(this, args);
        };
    });

    return events;
}
