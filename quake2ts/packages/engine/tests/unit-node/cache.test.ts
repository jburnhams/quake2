import { describe, expect, it } from 'vitest';
import { LruCache } from '@quake2ts/engine/assets/cache.js';

describe('LruCache', () => {
  it('evicts least recently used entries when capacity exceeded', () => {
    const cache = new LruCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });

  it('updates recency on get', () => {
    const cache = new LruCache<string>(2);
    cache.set('a', 'first');
    cache.set('b', 'second');
    expect(cache.get('a')).toBe('first');
    cache.set('c', 'third');

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.entries()[0].key).toBe('c');
  });

  it('exposes size and clear helpers', () => {
    const cache = new LruCache<number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('throws for invalid capacity', () => {
    expect(() => new LruCache(0)).toThrow(RangeError);
  });
});
