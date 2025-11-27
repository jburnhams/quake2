import { describe, it, expect } from 'vitest';
import { GetCGameAPI } from '../src/index.js';

describe('CGame Entry Point', () => {
  it('should export GetCGameAPI function', () => {
    expect(typeof GetCGameAPI).toBe('function');
  });

  it('should return an API object', () => {
    const api = GetCGameAPI();
    expect(api).toBeDefined();
    expect(typeof api).toBe('object');
  });
});
