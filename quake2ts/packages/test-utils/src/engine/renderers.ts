import { NullRenderer, LoggingRenderer, CoordinateSystem } from '@quake2ts/engine';
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
  const warnings = logs.filter((log: string) => log.includes('double-transform'));
  expect(warnings).toHaveLength(0);
}
