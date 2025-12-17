export interface CacheEntry<T> {
  key: string;
  value: T;
}

export class LruCache<T> {
  private readonly map = new Map<string, T>();
  private currentMemoryUsage = 0;

  constructor(
    private readonly capacity: number,
    private readonly maxMemory: number = Infinity,
    private readonly sizeCalculator: (value: T) => number = () => 0
  ) {
    if (capacity <= 0) {
      throw new RangeError('LRU cache capacity must be greater than zero');
    }
  }

  get size(): number {
    return this.map.size;
  }

  get memoryUsage(): number {
    return this.currentMemoryUsage;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get(key: string): T | undefined {
    const value = this.map.get(key);
    if (value === undefined) {
      return undefined;
    }
    // Refresh item position (delete and re-add)
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    const itemSize = this.sizeCalculator(value);

    // If item exists, remove it first (updating memory)
    if (this.map.has(key)) {
      this.delete(key);
    }

    this.map.set(key, value);
    this.currentMemoryUsage += itemSize;

    this.evict();
  }

  delete(key: string): boolean {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.currentMemoryUsage -= this.sizeCalculator(value);
      return this.map.delete(key);
    }
    return false;
  }

  clear(): void {
    this.map.clear();
    this.currentMemoryUsage = 0;
  }

  entries(): CacheEntry<T>[] {
    return Array.from(this.map.entries()).reverse().map(([key, value]) => ({ key, value }));
  }

  private evict(): void {
    // Evict based on capacity
    while (this.map.size > this.capacity) {
      const oldestKey = this.map.keys().next();
      if (!oldestKey.done) {
        this.delete(oldestKey.value);
      } else {
        break;
      }
    }

    // Evict based on memory
    while (this.currentMemoryUsage > this.maxMemory && this.map.size > 0) {
      const oldestKey = this.map.keys().next();
      if (!oldestKey.done) {
        this.delete(oldestKey.value);
      } else {
        break;
      }
    }
  }
}
