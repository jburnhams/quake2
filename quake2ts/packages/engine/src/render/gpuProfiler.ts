
import { MemoryUsage } from './types.js';

export interface GpuTimerResult {
  readonly timeElapsedNs: number;
}

export interface RenderStatistics {
  readonly frameTimeMs: number;
  readonly gpuTimeMs: number;
  readonly cpuFrameTimeMs: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly vertices: number;
  readonly textureBinds: number;
  readonly shaderSwitches: number;
  readonly visibleSurfaces: number;
  readonly culledSurfaces: number;
  readonly visibleEntities: number;
  readonly culledEntities: number;
  readonly memoryUsageMB: {
    readonly textures: number;
    readonly geometry: number;
    readonly total: number;
  };
}

export interface FrameStats {
    drawCalls: number;
    vertexCount: number;
    batches: number;
    shaderSwitches: number;
    visibleSurfaces: number;
    culledSurfaces: number;
    visibleEntities: number;
    culledEntities: number;
}

export class GpuProfiler {
  private readonly ext: any; // EXT_disjoint_timer_query_webgl2
  private readonly gl: WebGL2RenderingContext;
  private readonly activeQueries: WebGLQuery[] = [];
  private readonly queryPool: WebGLQuery[] = [];
  private currentQuery: WebGLQuery | null = null;
  private lastGpuTimeMs: number = 0;

  // CPU-side counters
  private frameStartTime: number = 0;
  private lastCpuFrameTimeMs: number = 0;

  // Resource Tracking
  private textureMemoryBytes: number = 0;
  private bufferMemoryBytes: number = 0;
  private shaderMemoryBytes: number = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    // Try to get the extension
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  }

  get available(): boolean {
    return !!this.ext;
  }

  // To be called by Renderer to construct the final report
  getPerformanceReport(frameStats: FrameStats): RenderStatistics {
      const textureMB = this.textureMemoryBytes / (1024 * 1024);
      const geometryMB = this.bufferMemoryBytes / (1024 * 1024);

      return {
          frameTimeMs: this.lastCpuFrameTimeMs, // Main frame time (CPU)
          gpuTimeMs: this.lastGpuTimeMs,
          cpuFrameTimeMs: this.lastCpuFrameTimeMs,
          drawCalls: frameStats.drawCalls,
          triangles: Math.floor(frameStats.vertexCount / 3), // Approximation if mostly triangles
          vertices: frameStats.vertexCount,
          textureBinds: frameStats.batches, // Using batches as proxy for texture binds
          shaderSwitches: frameStats.shaderSwitches,
          visibleSurfaces: frameStats.visibleSurfaces,
          culledSurfaces: frameStats.culledSurfaces,
          visibleEntities: frameStats.visibleEntities,
          culledEntities: frameStats.culledEntities,
          memoryUsageMB: {
              textures: textureMB,
              geometry: geometryMB,
              total: textureMB + geometryMB
          }
      };
  }

  startFrame(): void {
    this.frameStartTime = performance.now();

    if (!this.ext) return;

    if (this.currentQuery) {
        return;
    }

    const query = this.getQuery();
    if (query) {
      this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
      this.currentQuery = query;
    }
  }

  endFrame(): void {
    this.lastCpuFrameTimeMs = performance.now() - this.frameStartTime;

    if (!this.ext || !this.currentQuery) return;

    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.activeQueries.push(this.currentQuery);
    this.currentQuery = null;

    this.pollQueries();
  }

  trackTextureMemory(bytes: number) {
      this.textureMemoryBytes += bytes;
  }

  trackBufferMemory(bytes: number) {
      this.bufferMemoryBytes += bytes;
  }

  trackShaderMemory(bytes: number) {
      this.shaderMemoryBytes += bytes;
  }

  getMemoryUsage(): MemoryUsage {
      const texturesBytes = this.textureMemoryBytes;
      const geometryBytes = this.bufferMemoryBytes;
      const shadersBytes = this.shaderMemoryBytes;
      const buffersBytes = this.bufferMemoryBytes;
      const totalBytes = texturesBytes + geometryBytes + shadersBytes;

      return {
          texturesBytes,
          geometryBytes,
          shadersBytes,
          buffersBytes,
          totalBytes
      };
  }

  private getQuery(): WebGLQuery | null {
    if (this.queryPool.length > 0) {
      return this.queryPool.pop()!;
    }
    return this.gl.createQuery();
  }

  private pollQueries(): void {
    if (this.activeQueries.length === 0) return;

    // Check the oldest query
    const query = this.activeQueries[0];

    // Check if result is available
    const available = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE);
    const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT);

    if (available) {
      if (disjoint) {
        // Disjoint occurred, discard all queries
        this.activeQueries.forEach(q => this.queryPool.push(q));
        this.activeQueries.length = 0;
      } else {
        const timeElapsedNs = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT);
        this.lastGpuTimeMs = timeElapsedNs / 1000000.0;

        // Remove from active and return to pool
        this.activeQueries.shift();
        this.queryPool.push(query);
      }
    }
  }

  dispose(): void {
    // Delete all queries
    [...this.activeQueries, ...this.queryPool].forEach(q => this.gl.deleteQuery(q));
    this.activeQueries.length = 0;
    this.queryPool.length = 0;
  }
}
