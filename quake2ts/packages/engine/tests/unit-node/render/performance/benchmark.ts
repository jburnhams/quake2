/**
 * Benchmark framework for renderer performance testing
 *
 * Measures frame times, percentiles, and performance characteristics
 * for both WebGL and WebGPU renderers.
 */

import type { Camera } from '../../../../src/render/camera.js';

export interface BenchmarkOptions {
  warmupFrames?: number;
  measureFrames?: number;
  scene: TestScene;
  camera: Camera;
  name?: string;
}

export interface TestScene {
  // Scene data that can be passed to renderer
  [key: string]: any;
}

export interface BenchmarkResult {
  name: string;
  avgFrameTimeMs: number;
  minFrameTimeMs: number;
  maxFrameTimeMs: number;
  p50: number;
  p95: number;
  p99: number;
  totalFrames: number;
  stdDev: number;
}

/**
 * Calculate standard deviation of frame times
 */
function calculateStdDev(values: number[], mean: number): number {
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Benchmark a renderer function
 *
 * @param renderFn Function that renders a single frame
 * @param options Benchmark options
 * @returns Performance statistics
 */
export async function benchmarkRenderer(
  renderFn: () => void | Promise<void>,
  options: BenchmarkOptions
): Promise<BenchmarkResult> {
  const warmupFrames = options.warmupFrames ?? 30;
  const measureFrames = options.measureFrames ?? 300;
  const name = options.name ?? 'unnamed-benchmark';

  const frameTimes: number[] = [];

  // Warmup phase - ensure caches are hot, GPU is ready
  for (let i = 0; i < warmupFrames; i++) {
    await renderFn();
  }

  // Measurement phase
  for (let i = 0; i < measureFrames; i++) {
    const start = performance.now();
    await renderFn();
    const end = performance.now();
    frameTimes.push(end - start);
  }

  // Calculate statistics
  frameTimes.sort((a, b) => a - b);

  const sum = frameTimes.reduce((a, b) => a + b, 0);
  const avgFrameTimeMs = sum / frameTimes.length;

  return {
    name,
    avgFrameTimeMs,
    minFrameTimeMs: frameTimes[0],
    maxFrameTimeMs: frameTimes[frameTimes.length - 1],
    p50: frameTimes[Math.floor(frameTimes.length * 0.5)],
    p95: frameTimes[Math.floor(frameTimes.length * 0.95)],
    p99: frameTimes[Math.floor(frameTimes.length * 0.99)],
    totalFrames: measureFrames,
    stdDev: calculateStdDev(frameTimes, avgFrameTimeMs)
  };
}

/**
 * Compare two benchmark results and calculate regression
 */
export function compareBenchmarks(
  baseline: BenchmarkResult,
  current: BenchmarkResult
): {
  avgRegression: number;
  p95Regression: number;
  passed: boolean;
  threshold: number;
} {
  const threshold = 0.05; // 5% regression threshold

  const avgRegression = (current.avgFrameTimeMs - baseline.avgFrameTimeMs) / baseline.avgFrameTimeMs;
  const p95Regression = (current.p95 - baseline.p95) / baseline.p95;

  const passed = avgRegression <= threshold && p95Regression <= threshold;

  return {
    avgRegression,
    p95Regression,
    passed,
    threshold
  };
}

/**
 * Format benchmark result as human-readable string
 */
export function formatBenchmarkResult(result: BenchmarkResult): string {
  return `
Benchmark: ${result.name}
  Frames:  ${result.totalFrames}
  Average: ${result.avgFrameTimeMs.toFixed(2)}ms
  Min:     ${result.minFrameTimeMs.toFixed(2)}ms
  Max:     ${result.maxFrameTimeMs.toFixed(2)}ms
  P50:     ${result.p50.toFixed(2)}ms
  P95:     ${result.p95.toFixed(2)}ms
  P99:     ${result.p99.toFixed(2)}ms
  StdDev:  ${result.stdDev.toFixed(2)}ms
`.trim();
}
