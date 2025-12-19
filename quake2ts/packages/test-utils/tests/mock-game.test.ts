import { describe, it, expect, vi } from 'vitest';
import { createMockGameExports } from '../src/game/mock-game.js';

describe('Mock Game Exports', () => {
  it('should create a mock game exports object', () => {
    const game = createMockGameExports();

    expect(game).toBeDefined();
    expect(game.init).toBeDefined();
    expect(game.frame).toBeDefined();
    expect(game.shutdown).toBeDefined();

    // Check that methods are mocks
    expect(vi.isMockFunction(game.init)).toBe(true);
    expect(vi.isMockFunction(game.frame)).toBe(true);
  });

  it('should allow overrides', () => {
    const customInit = vi.fn();
    const game = createMockGameExports({ init: customInit });

    expect(game.init).toBe(customInit);
  });

  it('should return valid default return values', () => {
    const game = createMockGameExports();

    const initResult = game.init(0);
    expect(initResult).toHaveProperty('frame');
    expect(initResult).toHaveProperty('state');

    const frameResult = game.frame({ deltaSeconds: 0.1, frame: 1, time: 100 });
    expect(frameResult).toHaveProperty('frame');
    expect(frameResult).toHaveProperty('state');
  });
});
