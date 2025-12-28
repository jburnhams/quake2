import { NullRenderer } from '@quake2ts/engine/src/render/null/renderer.js';
import { LoggingRenderer } from '@quake2ts/engine/src/render/logging/renderer.js';
import { CoordinateSystem } from '@quake2ts/engine/src/render/types/coordinates.js';
import { expect } from 'vitest';

export function createNullRenderer(width = 800, height = 600): NullRenderer {
  return new NullRenderer(width, height);
}

export function createLoggingRenderer(
  targetSystem: CoordinateSystem = CoordinateSystem.QUAKE,
  options?: { verbose?: boolean; validateTransforms?: boolean }
): LoggingRenderer {
  return new LoggingRenderer({
    targetSystem,
    ...options
  });
}

// Assertion helpers
export function expectRendererCalls(
  renderer: NullRenderer,
  expectedCalls: string[]
): void {
  const actualCalls = renderer.getCallLog();
  expect(actualCalls).toEqual(expectedCalls);
}

export function expectNoDoubleTransform(renderer: LoggingRenderer): void {
  const logs = renderer.getLogs();
  const warnings = logs.filter(log => log.includes('double-transform'));
  expect(warnings).toHaveLength(0);
}
