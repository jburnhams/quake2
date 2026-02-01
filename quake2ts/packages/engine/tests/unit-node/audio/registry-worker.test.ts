import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioRegistry } from '../../../src/assets/audio.js';
import { VirtualFileSystem } from '../../../src/assets/vfs.js';

describe('AudioRegistry Worker', () => {
    let vfs: VirtualFileSystem;
    let workerMock: any;

    beforeEach(() => {
        vfs = new VirtualFileSystem();
        vi.spyOn(vfs, 'readFile').mockResolvedValue(new Uint8Array(100)); // Dummy data

        // Mock Worker
        workerMock = {
            postMessage: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            terminate: vi.fn(),
        };

        // Mock global Worker using class syntax
        vi.stubGlobal('Worker', class {
            constructor() {
                return workerMock;
            }
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('should use worker for WAV decoding if worker is present', async () => {
        const registry = new AudioRegistry(vfs, { workerPath: 'dummy.js' });

        const loadPromise = registry.load('sound/test.wav');

        await new Promise(resolve => setTimeout(resolve, 0));

        // Verify postMessage called with ID
        expect(workerMock.postMessage).toHaveBeenCalled();
        const callArgs = workerMock.postMessage.mock.calls[0];
        expect(callArgs[0]).toEqual({
            id: expect.any(Number),
            buffer: expect.any(ArrayBuffer),
            type: 'wav'
        });

        const requestId = callArgs[0].id;

        // Simulate worker response
        const handler = workerMock.addEventListener.mock.calls[0][1];
        handler({
            data: {
                id: requestId,
                type: 'success',
                data: {
                    sampleRate: 44100,
                    channels: 1,
                    bitsPerSample: 16,
                    samples: new Float32Array(100)
                }
            }
        });

        const result = await loadPromise;
        expect(result.sampleRate).toBe(44100);
    });

    it('should handle concurrent requests correctly', async () => {
        const registry = new AudioRegistry(vfs, { workerPath: 'dummy.js' });

        // Mock readFile to return different buffers if needed, or just rely on path
        const loadPromise1 = registry.load('sound/1.wav');
        const loadPromise2 = registry.load('sound/2.wav');

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(workerMock.postMessage).toHaveBeenCalledTimes(2);

        const call1 = workerMock.postMessage.mock.calls[0][0];
        const call2 = workerMock.postMessage.mock.calls[1][0];

        expect(call1.id).not.toBe(call2.id);

        // Respond to 2 first
        const handlers = workerMock.addEventListener.mock.calls.map((c: any) => c[1]);

        // Response for 2
        const response2 = {
            data: {
                id: call2.id,
                type: 'success',
                data: { sampleRate: 22050, channels: 1, bitsPerSample: 16, samples: new Float32Array(50) }
            }
        };
        handlers.forEach((h: any) => h(response2));

        // Response for 1
        const response1 = {
            data: {
                id: call1.id,
                type: 'success',
                data: { sampleRate: 44100, channels: 1, bitsPerSample: 16, samples: new Float32Array(100) }
            }
        };
        handlers.forEach((h: any) => h(response1));

        const result1 = await loadPromise1;
        const result2 = await loadPromise2;

        expect(result1.sampleRate).toBe(44100);
        expect(result2.sampleRate).toBe(22050);
    });

    it('should handle worker errors with ID', async () => {
        const registry = new AudioRegistry(vfs, { workerPath: 'dummy.js' });
        const loadPromise = registry.load('sound/fail.wav');

        await new Promise(resolve => setTimeout(resolve, 0));

        const callArgs = workerMock.postMessage.mock.calls[0];
        const requestId = callArgs[0].id;

        // Simulate worker error response
        const handler = workerMock.addEventListener.mock.calls[0][1];
        handler({
            data: {
                id: requestId,
                type: 'error',
                message: 'Parsing failed'
            }
        });

        await expect(loadPromise).rejects.toThrow('Parsing failed');
    });
});
