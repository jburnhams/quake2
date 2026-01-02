import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AsyncDemoParser } from '../../../src/demo/asyncParser';
import { NetworkMessageHandler } from '../../../src/demo/parser';
import type { DemoWorkerResponse, DemoWorkerRequest } from '../../../src/demo/demo.worker';

// Mock Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private listeners: Map<string, EventListenerOrEventListenerObject[]> = new Map();

  constructor() {}

  postMessage(data: any, transfer?: Transferable[]) {
    // Simulate worker receiving message
    const request = data as DemoWorkerRequest;
    if (request.type === 'parse') {
        // Simulate immediate response
        this.emitResponse({ type: 'serverData', protocol: 34, serverCount: 1, attractLoop: 0, gameDir: 'baseq2', playerNum: 0, levelName: 'q2dm1' });
        this.emitResponse({ type: 'complete' });
    }
  }

  terminate() {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  dispatchEvent(event: Event): boolean {
    // Basic mock implementation of dispatchEvent
    const type = event.type;
    const listeners = this.listeners.get(type);
    if (listeners) {
        listeners.forEach(l => {
            if (typeof l === 'function') l(event as any);
            else l.handleEvent(event as any);
        });
    }
    if (type === 'message' && this.onmessage) {
        this.onmessage(event as MessageEvent);
    }
    return true;
  }

  // Changed to public so tests can call it
  public emitResponse(data: DemoWorkerResponse) {
      const event = new MessageEvent('message', { data });
      this.dispatchEvent(event);
  }
}

// Global Mock
const originalWorker = global.Worker;

describe('AsyncDemoParser', () => {
  let mockWorker: MockWorker;

  beforeEach(() => {
    mockWorker = new MockWorker();
    // Use a class that returns the mock instance to satisfy 'new Worker()'
    global.Worker = class {
        constructor() {
            return mockWorker;
        }
    } as any;
    // Add spy properties if needed, e.g. for inspection
    vi.spyOn(global, 'Worker');
  });

  afterEach(() => {
    global.Worker = originalWorker;
  });

  it('should instantiate a worker', () => {
    const handler = {} as NetworkMessageHandler;
    new AsyncDemoParser(handler);
    expect(global.Worker).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'module' }));
  });

  it('should parse a demo buffer and invoke callbacks', async () => {
    const handler = {
        onServerData: vi.fn(),
        onConfigString: vi.fn(),
        onSpawnBaseline: vi.fn(),
        onFrame: vi.fn(),
        onCenterPrint: vi.fn(),
        onStuffText: vi.fn(),
        onPrint: vi.fn(),
        onSound: vi.fn(),
        onTempEntity: vi.fn(),
        onLayout: vi.fn(),
        onInventory: vi.fn(),
        onMuzzleFlash: vi.fn(),
        onMuzzleFlash2: vi.fn(),
        onDisconnect: vi.fn(),
        onReconnect: vi.fn(),
        onDownload: vi.fn(),
    };

    const parser = new AsyncDemoParser(handler);
    const buffer = new ArrayBuffer(10); // Dummy buffer

    // We rely on the MockWorker's implementation of postMessage to simulate the response
    await parser.parse(buffer);

    expect(handler.onServerData).toHaveBeenCalledWith(34, 1, 0, 'baseq2', 0, 'q2dm1', undefined, undefined);
  });

  it('should handle errors from worker', async () => {
      const handler = {} as NetworkMessageHandler;
      const parser = new AsyncDemoParser(handler);

      // Override mock for this test to throw error
      // We need to override the postMessage method on the instance we created
      mockWorker.postMessage = (data: any) => {
           // Simulate error
           mockWorker.emitResponse({ type: 'error', message: 'Parse failed' });
      };

      await expect(parser.parse(new ArrayBuffer(0))).rejects.toThrow('Parse failed');
  });
});
