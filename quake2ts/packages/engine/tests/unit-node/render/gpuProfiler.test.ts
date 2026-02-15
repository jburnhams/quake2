
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GpuProfiler } from '../../../src/render/gpuProfiler.js';

describe('GpuProfiler', () => {
  let gl: WebGL2RenderingContext;
  let ext: any;

  beforeEach(() => {
    // Mock WebGL2 context
    ext = {
      TIME_ELAPSED_EXT: 0x88BF,
      GPU_DISJOINT_EXT: 0x8FBB,
    };

    gl = {
      getExtension: vi.fn((name) => {
        if (name === 'EXT_disjoint_timer_query_webgl2') return ext;
        return null;
      }),
      createQuery: vi.fn(() => ({})),
      deleteQuery: vi.fn(),
      beginQuery: vi.fn(),
      endQuery: vi.fn(),
      getQueryParameter: vi.fn(),
      getParameter: vi.fn(),
      QUERY_RESULT_AVAILABLE: 0x8867,
      QUERY_RESULT: 0x8866,
    } as unknown as WebGL2RenderingContext;
  });

  it('detects availability of extension', () => {
    const profiler = new GpuProfiler(gl);
    expect(profiler.available).toBe(true);
  });

  it('handles missing extension gracefully', () => {
    (gl.getExtension as any).mockReturnValue(null);
    const profiler = new GpuProfiler(gl);
    expect(profiler.available).toBe(false);

    // Should not throw or call GL methods
    profiler.startFrame();
    profiler.endFrame();
    expect(gl.beginQuery).not.toHaveBeenCalled();
  });

  it('starts and ends a query', () => {
    const profiler = new GpuProfiler(gl);
    profiler.startFrame();
    expect(gl.createQuery).toHaveBeenCalled();
    expect(gl.beginQuery).toHaveBeenCalledWith(ext.TIME_ELAPSED_EXT, expect.anything());

    profiler.endFrame();
    expect(gl.endQuery).toHaveBeenCalledWith(ext.TIME_ELAPSED_EXT);
  });

  it('polls for results and updates stats', () => {
    const profiler = new GpuProfiler(gl);

    // Setup query behavior
    const query = {};
    (gl.createQuery as any).mockReturnValue(query);

    // Mock polling: first call not available, second call available with result
    (gl.getQueryParameter as any).mockImplementation((q: any, param: number) => {
      if (param === gl.QUERY_RESULT_AVAILABLE) return true;
      if (param === gl.QUERY_RESULT) return 2000000; // 2ms
      return 0;
    });

    (gl.getParameter as any).mockReturnValue(false); // No disjoint

    profiler.startFrame();
    profiler.endFrame();

    // Stats should be updated immediately because we mocked it to be available
    expect(profiler.getPerformanceReport({ drawCalls: 0, vertexCount: 0, batches: 0 }).gpuTimeMs).toBe(2);
    expect(gl.getQueryParameter).toHaveBeenCalledWith(query, gl.QUERY_RESULT);
  });

  it('handles disjoint events', () => {
    const profiler = new GpuProfiler(gl);
    (gl.getQueryParameter as any).mockReturnValue(true); // Available
    (gl.getParameter as any).mockReturnValue(true); // Disjoint!

    profiler.startFrame();
    profiler.endFrame();

    // Disjoint means we discard, so stats might be 0 or previous
    expect(gl.getQueryParameter).toHaveBeenCalledWith(expect.anything(), gl.QUERY_RESULT_AVAILABLE);
    // Should NOT fetch result
    expect(gl.getQueryParameter).not.toHaveBeenCalledWith(expect.anything(), gl.QUERY_RESULT);
  });
});
