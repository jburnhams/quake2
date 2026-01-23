import { vi } from 'vitest';
import type { EngineImports, TraceResult } from '@quake2ts/engine';
import { createMockRenderer } from './renderer.js';
import { createMockAssetManager } from './assets.js';
import { createTraceMock } from '../../shared/collision.js';

/**
 * Creates a mock EngineImports object for testing client/engine interactions.
 * Includes mocked trace, renderer, and asset manager by default.
 */
export function createMockEngineImports(overrides?: Partial<EngineImports>): EngineImports {
  const defaultTrace = vi.fn().mockReturnValue(createTraceMock({
      fraction: 1,
      endpos: { x: 0, y: 0, z: 0 },
      ent: -1 as any
  }) as unknown as TraceResult);

  return {
    trace: defaultTrace,
    renderer: createMockRenderer(),
    assets: createMockAssetManager(),
    ...overrides
  };
}
