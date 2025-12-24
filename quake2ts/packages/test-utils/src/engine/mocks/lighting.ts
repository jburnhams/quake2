import { vi } from 'vitest';
import { Vec3 } from '@quake2ts/shared';
import { DLight, DynamicLightManager } from '@quake2ts/engine';

// Export types
export { DLight, DynamicLightManager };

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
  // Note: 'removeLight' is not in the real class I saw in `dlight.ts`, only add/clear/update/getActiveLights.
  // I will stick to what I saw in `dlight.ts` plus what the task asked for (maybe the task implies adding it or just mocking it if it existed?).
  // Actually, let's look at `dlight.ts` again. It has `addLight`, `clear`, `update`, `getActiveLights`.
  // The task list mentions `removeLight()` but the source doesn't have it explicitly (it's done via update/die).
  // I will implement the methods that exist and mock the ones requested if they make sense or are needed by tests.

  const mockManager = {
    addLight: vi.fn(),
    clear: vi.fn(),
    update: vi.fn(),
    getActiveLights: vi.fn().mockReturnValue([]),
    // Tests might expect these if they were using a different version or if I should add them to the mock for convenience
    getLights: vi.fn().mockReturnValue([]),
    removeLight: vi.fn(),
    ...overrides
  };

  // Alias getLights to getActiveLights if not overridden, to satisfy potential task requirements matching API
  if (!overrides?.getLights) {
    mockManager.getLights.mockImplementation(() => mockManager.getActiveLights());
  }

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
