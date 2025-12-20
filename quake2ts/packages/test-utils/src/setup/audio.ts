/**
 * Mocks for Web Audio API.
 */

/**
 * Sets up a mock AudioContext globally.
 */
export function setupMockAudioContext(): void {
  class MockAudioContext {
    state = 'suspended';
    destination = {};
    currentTime = 0;
    listener = {
        positionX: { value: 0 },
        positionY: { value: 0 },
        positionZ: { value: 0 },
        forwardX: { value: 0 },
        forwardY: { value: 0 },
        forwardZ: { value: 0 },
        upX: { value: 0 },
        upY: { value: 0 },
        upZ: { value: 0 },
        setOrientation: () => {},
        setPosition: () => {}
    };

    createGain() {
      return {
        gain: { value: 1, linearRampToValueAtTime: () => {} },
        connect: () => {},
        disconnect: () => {}
      };
    }

    createBufferSource() {
        return {
            buffer: null,
            loop: false,
            playbackRate: { value: 1 },
            connect: () => {},
            start: () => {},
            stop: () => {},
            disconnect: () => {},
            onended: null
        };
    }

    createPanner() {
        return {
            panningModel: 'equalpower',
            distanceModel: 'inverse',
            positionX: { value: 0 },
            positionY: { value: 0 },
            positionZ: { value: 0 },
            orientationX: { value: 0 },
            orientationY: { value: 0 },
            orientationZ: { value: 0 },
            coneInnerAngle: 360,
            coneOuterAngle: 360,
            coneOuterGain: 0,
            connect: () => {},
            disconnect: () => {},
            setPosition: () => {},
            setOrientation: () => {}
        }
    }

    createBuffer(numOfChannels: number, length: number, sampleRate: number) {
        return {
            duration: length / sampleRate,
            length,
            sampleRate,
            numberOfChannels: numOfChannels,
            getChannelData: () => new Float32Array(length)
        }
    }

    decodeAudioData(data: ArrayBuffer, success?: (buffer: any) => void) {
        const buffer = this.createBuffer(2, 100, 44100);
        if (success) success(buffer);
        return Promise.resolve(buffer);
    }

    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }

  global.AudioContext = MockAudioContext as any;
  // @ts-ignore
  global.webkitAudioContext = MockAudioContext as any;
}

/**
 * Restores original AudioContext.
 */
export function teardownMockAudioContext(): void {
  // @ts-ignore
  delete global.AudioContext;
  // @ts-ignore
  delete global.webkitAudioContext;
}

export interface AudioEvent {
  type: string;
  data?: any;
}

/**
 * Captures audio events from a context.
 * Requires the context to be instrumented or mocked to emit events.
 * This helper currently works with the `setupMockAudioContext` mock if extended.
 */
export function captureAudioEvents(context: AudioContext): AudioEvent[] {
  // Placeholder for capturing events.
  // Real implementation would attach spies to context methods.
  return [];
}
