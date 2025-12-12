
export interface AssetLoader<T> {
  load(path: string): Promise<T>;
}

export interface StreamOptions {
  priority?: number; // Higher is better
}

interface PendingRequest {
  path: string;
  priority: number;
  resolve: () => void;
  reject: (err: any) => void;
}

export class AssetStreamer {
  private queue: PendingRequest[] = [];
  private activeDownloads = 0;
  private maxConcurrent = 4;

  constructor(
      private readonly concurrency: number = 4
  ) {
      this.maxConcurrent = concurrency;
  }

  async preloadAssets(paths: string[]): Promise<void> {
    const promises = paths.map(path => this.schedule(path, 1)); // Default priority
    await Promise.all(promises);
  }

  private schedule(path: string, priority: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ path, priority, resolve, reject });
      this.queue.sort((a, b) => b.priority - a.priority);
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.activeDownloads >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const req = this.queue.shift();
    if (!req) return;

    this.activeDownloads++;

    try {
        // Simulation of load
        req.resolve();
    } catch (e) {
        req.reject(e);
    } finally {
        this.activeDownloads--;
        // Use timeout to prevent stack overflow in sync simulation
        setTimeout(() => this.processQueue(), 0);
    }
  }
}
