import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AsyncDemoParser } from '../../../src/demo/asyncParser.js';
import { NetworkMessageHandler } from '../../../src/demo/parser.js';

// Mock Worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;

  private listeners: Map<string, Array<(e: Event) => void>> = new Map();

  constructor(scriptURL: string | URL, options?: WorkerOptions) {
    //
  }

  postMessage(data: any, transfer?: Transferable[]) {
    // Simulate async processing
    setTimeout(() => {
      // Simulate progress
      if (data.type === 'parse') {
        this.emit('message', { data: { type: 'progress', percent: 0.1 } });
        this.emit('message', { data: { type: 'progress', percent: 0.5 } });
        this.emit('message', { data: { type: 'progress', percent: 1.0 } });
        this.emit('message', { data: { type: 'complete' } });
      }
    }, 10);
  }

  terminate() {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener as any);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const list = this.listeners.get(type);
    if (list) {
      const index = list.indexOf(listener as any);
      if (index !== -1) {
        list.splice(index, 1);
      }
    }
  }

  private emit(type: string, eventInit: any) {
    const event = { ...eventInit, type };
    if (type === 'message' && this.onmessage) {
        this.onmessage(event);
    }
    const list = this.listeners.get(type);
    if (list) {
        list.forEach(l => l(event));
    }
  }
}

// Global Worker mock
global.Worker = MockWorker as any;

describe('AsyncDemoParser', () => {
  let parser: AsyncDemoParser;
  let mockHandler: NetworkMessageHandler;

  beforeEach(() => {
    mockHandler = {
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
    parser = new AsyncDemoParser(mockHandler);
  });

  afterEach(() => {
    parser.terminate();
  });

  it('should report progress during parsing', async () => {
    const progressCallback = vi.fn();
    const buffer = new ArrayBuffer(100);

    await parser.parse(buffer, { onProgress: progressCallback });

    expect(progressCallback).toHaveBeenCalledTimes(3);
    expect(progressCallback).toHaveBeenNthCalledWith(1, 0.1);
    expect(progressCallback).toHaveBeenNthCalledWith(2, 0.5);
    expect(progressCallback).toHaveBeenNthCalledWith(3, 1.0);
  });
});
