import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BspLoader } from '../../../src/assets/bsp.js';
import { VirtualFileSystem } from '../../../src/assets/vfs.js';

describe('BspLoader with Worker', () => {
  let vfs: VirtualFileSystem;
  let loader: BspLoader;

  beforeEach(() => {
    vfs = {
      readFile: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    } as unknown as VirtualFileSystem;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should use worker when configured', async () => {
    const mockBspData = {
        header: { version: 38 },
        entities: { entities: [] },
        models: [],
        nodes: [],
        leafs: [],
        planes: [],
        visibility: undefined
    };

    // Capture worker
    let capturedWorker: any;

    // Stub Global Worker with a Class that returns the mock instance
    vi.stubGlobal('Worker', class {
        constructor() {
            const worker = {
                postMessage: vi.fn(),
                terminate: vi.fn(),
                onmessage: null,
                onerror: null,
            };
            capturedWorker = worker;
            return worker;
        }
    });

    loader = new BspLoader(vfs, { useWorker: true, workerPath: '/worker.js' });

    const loadPromise = loader.load('maps/test.bsp');

    // Wait for worker to be created
    let retries = 0;
    while (!capturedWorker && retries < 10) {
        await new Promise(resolve => setTimeout(resolve, 10));
        retries++;
    }

    if (!capturedWorker) {
        throw new Error('Worker was not created within timeout');
    }

    // Wait for onmessage to be assigned
    retries = 0;
    while (!capturedWorker.onmessage && retries < 10) {
        await new Promise(resolve => setTimeout(resolve, 10));
        retries++;
    }

    if (!capturedWorker.onmessage) {
        throw new Error('Worker.onmessage was not assigned');
    }

    // Simulate worker reply
    capturedWorker.onmessage({ data: { type: 'success', data: mockBspData } } as MessageEvent);

    const result = await loadPromise;
    expect(result.header.version).toBe(38);
    // Check if methods are attached
    expect(typeof result.pickEntity).toBe('function');
    expect(capturedWorker.terminate).toHaveBeenCalled();
  });
});
