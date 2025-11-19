export interface CacheEntry<T> {
  key: string;
  value: T;
}

export class LruCache<T> {
  private readonly map = new Map<string, T>();

  constructor(private readonly capacity: number) {
    if (capacity <= 0) {
      throw new RangeError('LRU cache capacity must be greater than zero');
    }
  }

  get size(): number {
    return this.map.size;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get(key: string): T | undefined {
    const value = this.map.get(key);
    if (value === undefined) {
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  entries(): CacheEntry<T>[] {
    return Array.from(this.map.entries()).reverse().map(([key, value]) => ({ key, value }));
  }
}
