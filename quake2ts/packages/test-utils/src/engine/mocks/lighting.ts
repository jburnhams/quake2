import { vi } from 'vitest';
import { Vec3 } from '@quake2ts/shared';
import { DynamicLightManager } from '@quake2ts/engine';
import type { DLight } from '@quake2ts/engine';

// Export types
export { DynamicLightManager };
export type { DLight };

// Mock Lightmap type since it's typically just a raw buffer or texture in the engine
// But based on the task "Add createMockLightmap() factory", we'll create a simple structure.
export interface Lightmap {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Creates a mock DLight with default values.
 */
export function createMockDLight(
  position: Vec3 = { x: 0, y: 0, z: 0 },
  color: Vec3 = { x: 1, y: 1, z: 1 },
  intensity: number = 300
): DLight {
  return {
    origin: { ...position },
    color: { ...color },
    intensity,
    die: Number.MAX_SAFE_INTEGER,
  };
}

/**
 * Creates a mock DynamicLightManager with spy methods.
 */
export function createMockDLightManager(overrides?: Partial<DynamicLightManager>): DynamicLightManager {
  // We can't easily spy on methods of a real instance if we just return an object literal
  // that mimics the interface, unless we use the real class or a full mock.
  // Since DynamicLightManager is a class with logic, let's create a real instance and spy on it,
  // or return a complete mock object if we want to avoid logic.
  // The task says "Add createMockDLightManager factory... Methods: addLight, removeLight, clear, getLights".

  // Let's create a mock object that satisfies the public interface (structural typing).

  const mockManager = {
    addLight: vi.fn(),
    clear: vi.fn(),
    update: vi.fn(),
    getActiveLights: vi.fn().mockReturnValue([]),
    ...overrides
  };

  return mockManager as unknown as DynamicLightManager;
}

/**
 * Creates a mock lightmap data structure.
 */
export function createMockLightmap(width: number = 128, height: number = 128): Lightmap {
  return {
    width,
    height,
    data: new Uint8Array(width * height * 3) // RGB
  };
}
