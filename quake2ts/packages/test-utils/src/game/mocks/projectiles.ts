import { vi, type Mock } from 'vitest';

/**
 * Interface representing mock projectile creation functions.
 */
export interface MockProjectiles {
  createBlasterBolt: Mock;
  createRocket: Mock;
  createGrenade: Mock;
  createBfgBall: Mock;
}

/**
 * Creates mock projectile functions.
 * Useful for verifying weapon firing logic without spawning actual entities.
 *
 * @param overrides - Optional overrides for specific projectile functions.
 * @returns An object containing mocked projectile creation functions.
 */
export function createMockProjectiles(overrides: Partial<MockProjectiles> = {}): MockProjectiles {
  return {
    createBlasterBolt: vi.fn(),
    createRocket: vi.fn(),
    createGrenade: vi.fn(),
    createBfgBall: vi.fn(),
    ...overrides
  };
}
