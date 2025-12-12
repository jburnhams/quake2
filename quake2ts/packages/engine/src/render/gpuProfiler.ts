
export interface GpuTimerResult {
  readonly timeElapsedNs: number;
}

export interface GpuProfilerStats {
  readonly gpuTimeMs: number;
}

export class GpuProfiler {
  private readonly ext: any; // EXT_disjoint_timer_query_webgl2
  private readonly gl: WebGL2RenderingContext;
  private readonly activeQueries: WebGLQuery[] = [];
  private readonly queryPool: WebGLQuery[] = [];
  private currentQuery: WebGLQuery | null = null;
  private lastGpuTimeMs: number = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    // Try to get the extension
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  }

  get available(): boolean {
    return !!this.ext;
  }

  get stats(): GpuProfilerStats {
    return {
      gpuTimeMs: this.lastGpuTimeMs,
    };
  }

  startFrame(): void {
    if (!this.ext) return;

    // If we are already in a query (nested?), ignore or warn.
    // For now, assume simple one-frame-at-a-time.
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
    if (!this.ext || !this.currentQuery) return;

    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.activeQueries.push(this.currentQuery);
    this.currentQuery = null;

    this.pollQueries();
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
