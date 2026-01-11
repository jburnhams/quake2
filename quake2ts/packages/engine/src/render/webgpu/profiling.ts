/// <reference types="@webgpu/types" />

import { RenderStatistics, FrameStats } from '../gpuProfiler.js';
import { MemoryUsage } from '../types.js';
import { GPUResourceTracker, getResourceTracker } from './resources.js';

/**
 * GPU timestamp query result for a labeled measurement
 */
export interface TimestampResult {
  readonly label: string;
  readonly timeMs: number;
}

/**
 * Profiling query set configuration
 */
export interface QuerySetConfig {
  /** Maximum number of timestamp queries per frame */
  readonly maxQueries: number;
  /** Number of frames to buffer for async readback */
  readonly frameBufferDepth: number;
}

const DEFAULT_CONFIG: QuerySetConfig = {
  maxQueries: 32,
  frameBufferDepth: 3,
};

/**
 * Per-pass timing information
 */
export interface PassTimings {
  readonly opaque?: number;
  readonly transparent?: number;
  readonly postProcess?: number;
  readonly ui?: number;
  readonly total?: number;
}

/**
 * Detailed profiling results for a frame
 */
export interface ProfilingResults {
  readonly cpuFrameTimeMs: number;
  readonly gpuFrameTimeMs: number;
  readonly passTimings: PassTimings;
  readonly queryResults: ReadonlyMap<string, number>;
}

/**
 * Frame timing entry for tracking async readback
 */
interface FrameTimingEntry {
  querySet: GPUQuerySet;
  resolveBuffer: GPUBuffer;
  readbackBuffer: GPUBuffer;
  queryCount: number;
  labels: string[];
  cpuStartTime: number;
  cpuEndTime: number;
  pending: boolean;
}

/**
 * WebGPU Performance Profiler
 *
 * Provides GPU timestamp queries (when available) and CPU timing for measuring
 * render pass performance. Supports labeling individual measurements and
 * aggregating statistics across frames.
 */
export class WebGPUProfiler {
  private readonly device: GPUDevice;
  private readonly config: QuerySetConfig;
  private readonly timestampSupported: boolean;

  // Frame timing entries for async readback (ring buffer)
  private frameEntries: FrameTimingEntry[] = [];
  private currentFrameIndex = 0;

  // Current frame state
  private currentQuerySet: GPUQuerySet | null = null;
  private currentQueryIndex = 0;
  private currentLabels: string[] = [];
  private frameStartTime = 0;
  private frameEndTime = 0;

  // Results from completed frames
  private lastResults: ProfilingResults = {
    cpuFrameTimeMs: 0,
    gpuFrameTimeMs: 0,
    passTimings: {},
    queryResults: new Map(),
  };

  // Moving average for smoothed statistics
  private readonly frameTimeHistory: number[] = [];
  private readonly gpuTimeHistory: number[] = [];
  private readonly historySize = 60; // 1 second at 60fps

  // Frame statistics accumulator
  private currentFrameStats: FrameStats = {
    drawCalls: 0,
    vertexCount: 0,
    batches: 0,
    shaderSwitches: 0,
    visibleSurfaces: 0,
    culledSurfaces: 0,
    visibleEntities: 0,
    culledEntities: 0,
  };

  constructor(device: GPUDevice, config: Partial<QuerySetConfig> = {}) {
    this.device = device;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.timestampSupported = device.features.has('timestamp-query');

    if (this.timestampSupported) {
      this.initializeQuerySets();
    }
  }

  /**
   * Check if GPU timestamp queries are supported
   */
  get isTimestampSupported(): boolean {
    return this.timestampSupported;
  }

  /**
   * Get the last profiling results
   */
  get results(): ProfilingResults {
    return this.lastResults;
  }

  /**
   * Get smoothed frame time (moving average)
   */
  get smoothedFrameTimeMs(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
    return sum / this.frameTimeHistory.length;
  }

  /**
   * Get smoothed GPU time (moving average)
   */
  get smoothedGpuTimeMs(): number {
    if (this.gpuTimeHistory.length === 0) return 0;
    const sum = this.gpuTimeHistory.reduce((a, b) => a + b, 0);
    return sum / this.gpuTimeHistory.length;
  }

  /**
   * Initialize query sets for timestamp queries
   */
  private initializeQuerySets(): void {
    for (let i = 0; i < this.config.frameBufferDepth; i++) {
      const querySet = this.device.createQuerySet({
        type: 'timestamp',
        count: this.config.maxQueries,
        label: `profiler-query-set-${i}`,
      });

      // Buffer to resolve queries into (GPU-side)
      const resolveBuffer = this.device.createBuffer({
        size: this.config.maxQueries * 8, // 8 bytes per timestamp (bigint)
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
        label: `profiler-resolve-buffer-${i}`,
      });

      // Buffer for CPU readback
      const readbackBuffer = this.device.createBuffer({
        size: this.config.maxQueries * 8,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        label: `profiler-readback-buffer-${i}`,
      });

      this.frameEntries.push({
        querySet,
        resolveBuffer,
        readbackBuffer,
        queryCount: 0,
        labels: [],
        cpuStartTime: 0,
        cpuEndTime: 0,
        pending: false,
      });
    }
  }

  /**
   * Begin profiling a new frame
   */
  startFrame(): void {
    this.frameStartTime = performance.now();
    this.currentQueryIndex = 0;
    this.currentLabels = [];

    // Reset frame stats
    this.currentFrameStats = {
      drawCalls: 0,
      vertexCount: 0,
      batches: 0,
      shaderSwitches: 0,
      visibleSurfaces: 0,
      culledSurfaces: 0,
      visibleEntities: 0,
      culledEntities: 0,
    };

    if (this.timestampSupported) {
      // Get next frame entry from ring buffer
      const entry = this.frameEntries[this.currentFrameIndex];

      // If this entry is pending, we need to wait or skip
      // For simplicity, we'll just overwrite (not ideal for accuracy)
      this.currentQuerySet = entry.querySet;
      entry.cpuStartTime = this.frameStartTime;
      entry.labels = [];
      entry.queryCount = 0;
      entry.pending = false;
    }
  }

  /**
   * Insert a timestamp query with a label
   * Call this before and after render passes to measure their duration
   */
  writeTimestamp(commandEncoder: GPUCommandEncoder, label: string): void {
    if (!this.timestampSupported || !this.currentQuerySet) return;
    if (this.currentQueryIndex >= this.config.maxQueries) return;

    commandEncoder.writeTimestamp(this.currentQuerySet, this.currentQueryIndex);
    this.currentLabels.push(label);
    this.currentQueryIndex++;
  }

  /**
   * Increment draw call counter
   */
  recordDrawCall(vertexCount: number = 0): void {
    this.currentFrameStats.drawCalls++;
    this.currentFrameStats.vertexCount += vertexCount;
  }

  /**
   * Record batch count
   */
  recordBatch(): void {
    this.currentFrameStats.batches++;
  }

  /**
   * Record shader switch
   */
  recordShaderSwitch(): void {
    this.currentFrameStats.shaderSwitches++;
  }

  /**
   * Record visibility culling statistics
   */
  recordCulling(visible: number, culled: number, type: 'surface' | 'entity'): void {
    if (type === 'surface') {
      this.currentFrameStats.visibleSurfaces += visible;
      this.currentFrameStats.culledSurfaces += culled;
    } else {
      this.currentFrameStats.visibleEntities += visible;
      this.currentFrameStats.culledEntities += culled;
    }
  }

  /**
   * Get current frame statistics
   */
  getCurrentFrameStats(): Readonly<FrameStats> {
    return this.currentFrameStats;
  }

  /**
   * End profiling for the current frame
   * This resolves timestamp queries and initiates async readback
   */
  endFrame(commandEncoder: GPUCommandEncoder): void {
    this.frameEndTime = performance.now();
    const cpuTime = this.frameEndTime - this.frameStartTime;

    // Update CPU time history
    this.frameTimeHistory.push(cpuTime);
    if (this.frameTimeHistory.length > this.historySize) {
      this.frameTimeHistory.shift();
    }

    if (this.timestampSupported && this.currentQuerySet && this.currentQueryIndex > 0) {
      const entry = this.frameEntries[this.currentFrameIndex];
      entry.queryCount = this.currentQueryIndex;
      entry.labels = [...this.currentLabels];
      entry.cpuEndTime = this.frameEndTime;
      entry.pending = true;

      // Resolve timestamps to buffer
      commandEncoder.resolveQuerySet(
        this.currentQuerySet,
        0,
        this.currentQueryIndex,
        entry.resolveBuffer,
        0
      );

      // Copy to readback buffer
      commandEncoder.copyBufferToBuffer(
        entry.resolveBuffer,
        0,
        entry.readbackBuffer,
        0,
        this.currentQueryIndex * 8
      );

      // Advance to next frame in ring buffer
      this.currentFrameIndex = (this.currentFrameIndex + 1) % this.config.frameBufferDepth;
    }

    // Update last results with CPU time (GPU time will be updated asynchronously)
    this.lastResults = {
      ...this.lastResults,
      cpuFrameTimeMs: cpuTime,
    };
  }

  /**
   * Poll for completed timestamp query results
   * This should be called periodically (e.g., once per frame after submission)
   */
  async pollResults(): Promise<void> {
    if (!this.timestampSupported) return;

    for (const entry of this.frameEntries) {
      if (!entry.pending || entry.queryCount === 0) continue;

      // Try to map the readback buffer
      try {
        await entry.readbackBuffer.mapAsync(GPUMapMode.READ);
        const data = new BigUint64Array(entry.readbackBuffer.getMappedRange());

        // Process timestamp data
        const queryResults = new Map<string, number>();
        let totalGpuTime = 0;

        // Timestamps are in nanoseconds
        for (let i = 1; i < entry.queryCount; i++) {
          const startNs = data[i - 1];
          const endNs = data[i];
          const durationMs = Number(endNs - startNs) / 1_000_000;

          const label = entry.labels[i - 1] + '->' + entry.labels[i];
          queryResults.set(label, durationMs);
          totalGpuTime += durationMs;
        }

        // Calculate total GPU time (first to last timestamp)
        if (entry.queryCount >= 2) {
          totalGpuTime = Number(data[entry.queryCount - 1] - data[0]) / 1_000_000;
        }

        // Update GPU time history
        this.gpuTimeHistory.push(totalGpuTime);
        if (this.gpuTimeHistory.length > this.historySize) {
          this.gpuTimeHistory.shift();
        }

        // Extract pass timings from labels
        const passTimings = this.extractPassTimings(queryResults);

        // Update last results
        this.lastResults = {
          cpuFrameTimeMs: entry.cpuEndTime - entry.cpuStartTime,
          gpuFrameTimeMs: totalGpuTime,
          passTimings,
          queryResults,
        };

        entry.readbackBuffer.unmap();
        entry.pending = false;
      } catch {
        // Buffer not ready yet, skip
      }
    }
  }

  /**
   * Extract pass timings from query results
   */
  private extractPassTimings(queryResults: Map<string, number>): PassTimings {
    const timings: PassTimings = {};

    for (const [label, time] of queryResults) {
      if (label.includes('opaque')) {
        timings.opaque = (timings.opaque || 0) + time;
      } else if (label.includes('transparent')) {
        timings.transparent = (timings.transparent || 0) + time;
      } else if (label.includes('post') || label.includes('postprocess')) {
        timings.postProcess = (timings.postProcess || 0) + time;
      } else if (label.includes('ui') || label.includes('2d') || label.includes('hud')) {
        timings.ui = (timings.ui || 0) + time;
      }
    }

    return timings;
  }

  /**
   * Get a comprehensive performance report
   */
  getPerformanceReport(frameStats?: FrameStats): RenderStatistics {
    const stats = frameStats || this.currentFrameStats;
    const tracker = getResourceTracker() as GPUResourceTracker | undefined;

    const textureMemoryMB = tracker ? tracker.totalTextureMemory / (1024 * 1024) : 0;
    const bufferMemoryMB = tracker ? tracker.totalBufferMemory / (1024 * 1024) : 0;

    return {
      frameTimeMs: this.lastResults.cpuFrameTimeMs,
      gpuTimeMs: this.lastResults.gpuFrameTimeMs,
      cpuFrameTimeMs: this.lastResults.cpuFrameTimeMs,
      drawCalls: stats.drawCalls,
      triangles: Math.floor(stats.vertexCount / 3),
      vertices: stats.vertexCount,
      textureBinds: stats.batches,
      shaderSwitches: stats.shaderSwitches,
      visibleSurfaces: stats.visibleSurfaces,
      culledSurfaces: stats.culledSurfaces,
      visibleEntities: stats.visibleEntities,
      culledEntities: stats.culledEntities,
      memoryUsageMB: {
        textures: textureMemoryMB,
        geometry: bufferMemoryMB,
        total: textureMemoryMB + bufferMemoryMB,
      },
    };
  }

  /**
   * Get memory usage from resource tracker
   */
  getMemoryUsage(): MemoryUsage {
    const tracker = getResourceTracker() as GPUResourceTracker | undefined;

    if (!tracker) {
      return {
        texturesBytes: 0,
        geometryBytes: 0,
        shadersBytes: 0,
        buffersBytes: 0,
        totalBytes: 0,
      };
    }

    const texturesBytes = tracker.totalTextureMemory;
    const buffersBytes = tracker.totalBufferMemory;

    return {
      texturesBytes,
      geometryBytes: buffersBytes,
      shadersBytes: 0, // Not tracked currently
      buffersBytes,
      totalBytes: texturesBytes + buffersBytes,
    };
  }

  /**
   * Get timestamp results as array of milliseconds
   * This is for the IWebGPURenderer.getTimestampResults() interface
   */
  getTimestampResults(): number[] {
    if (!this.timestampSupported) return [];
    return Array.from(this.lastResults.queryResults.values());
  }

  /**
   * Reset all statistics and clear history
   */
  reset(): void {
    this.frameTimeHistory.length = 0;
    this.gpuTimeHistory.length = 0;
    this.lastResults = {
      cpuFrameTimeMs: 0,
      gpuFrameTimeMs: 0,
      passTimings: {},
      queryResults: new Map(),
    };
  }

  /**
   * Dispose of all GPU resources
   */
  dispose(): void {
    for (const entry of this.frameEntries) {
      entry.querySet.destroy();
      entry.resolveBuffer.destroy();
      entry.readbackBuffer.destroy();
    }
    this.frameEntries.length = 0;
  }
}

/**
 * Extended resource tracker with additional profiling metrics
 */
export class ProfilingResourceTracker extends GPUResourceTracker {
  private _pipelineCount = 0;
  private _bindGroupCount = 0;
  private _samplerCount = 0;

  trackPipeline(): void {
    this._pipelineCount++;
  }

  untrackPipeline(): void {
    this._pipelineCount--;
  }

  trackBindGroup(): void {
    this._bindGroupCount++;
  }

  untrackBindGroup(): void {
    this._bindGroupCount--;
  }

  trackSampler(): void {
    this._samplerCount++;
  }

  untrackSampler(): void {
    this._samplerCount--;
  }

  get pipelineCount(): number {
    return this._pipelineCount;
  }

  get bindGroupCount(): number {
    return this._bindGroupCount;
  }

  get samplerCount(): number {
    return this._samplerCount;
  }

  override reset(): void {
    super.reset();
    this._pipelineCount = 0;
    this._bindGroupCount = 0;
    this._samplerCount = 0;
  }

  /**
   * Get a summary of all tracked resources
   */
  getSummary(): {
    bufferMemory: number;
    textureMemory: number;
    bufferCount: number;
    textureCount: number;
    pipelineCount: number;
    bindGroupCount: number;
    samplerCount: number;
  } {
    return {
      bufferMemory: this.totalBufferMemory,
      textureMemory: this.totalTextureMemory,
      bufferCount: this.bufferCount,
      textureCount: this.textureCount,
      pipelineCount: this._pipelineCount,
      bindGroupCount: this._bindGroupCount,
      samplerCount: this._samplerCount,
    };
  }
}

/**
 * Export profiling data for external tools or debug UI
 */
export interface ProfilingExport {
  timestamp: number;
  frameTimeMs: number;
  gpuTimeMs: number;
  drawCalls: number;
  triangles: number;
  memoryMB: number;
  passTimings: PassTimings;
}

/**
 * Create an export-friendly snapshot of profiling data
 */
export function exportProfilingData(profiler: WebGPUProfiler): ProfilingExport {
  const report = profiler.getPerformanceReport();
  return {
    timestamp: Date.now(),
    frameTimeMs: report.frameTimeMs,
    gpuTimeMs: report.gpuTimeMs,
    drawCalls: report.drawCalls,
    triangles: report.triangles,
    memoryMB: report.memoryUsageMB.total,
    passTimings: profiler.results.passTimings,
  };
}
