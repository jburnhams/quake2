import { vi, type Mock } from 'vitest';

/**
 * Interface representing mock damage functions.
 */
export interface MockDamage {
  T_Damage: Mock;
  T_RadiusDamage: Mock;
}

/**
 * Creates mock damage functions.
 * Useful for verifying combat logic without side effects.
 *
 * @param overrides - Optional overrides for specific damage functions.
 * @returns An object containing mocked damage functions.
 */
export function createMockDamage(overrides: Partial<MockDamage> = {}): MockDamage {
  return {
    T_Damage: vi.fn(),
    T_RadiusDamage: vi.fn(),
    ...overrides
  };
}
