import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BspSurfacePipeline, BspSurfaceBindOptions } from '@quake2ts/engine/render/bspPipeline.js';
import { DLight } from '@quake2ts/engine/render/dlight.js';

// Mock WebGL context
const gl = {
  createProgram: vi.fn(() => ({})),
  createShader: vi.fn(() => ({})),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  getShaderParameter: vi.fn(() => true),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  getProgramParameter: vi.fn(() => true),
  useProgram: vi.fn(),
  getUniformLocation: vi.fn((program, name) => name),
  getAttribLocation: vi.fn(),
  bindAttribLocation: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  blendFunc: vi.fn(),
  depthMask: vi.fn(),
  uniformMatrix4fv: vi.fn(),
  uniform2f: vi.fn(),
  uniform3f: vi.fn(),
  uniform4fv: vi.fn(),
  uniform4f: vi.fn(), // Added for u_solidColor
  uniform1f: vi.fn(),
  uniform1i: vi.fn(),
  deleteProgram: vi.fn(),
  deleteShader: vi.fn(),
} as unknown as WebGL2RenderingContext;

describe('BspSurfacePipeline', () => {
  let pipeline: BspSurfacePipeline;

  beforeEach(() => {
    vi.clearAllMocks();
    pipeline = new BspSurfacePipeline(gl);
  });

  it('should bind dlights correctly', () => {
    const dlights: DLight[] = [
      {
        origin: { x: 10, y: 20, z: 30 },
        color: { x: 1, y: 0.5, z: 0 },
        intensity: 200,
        die: 0
      },
      {
        origin: { x: -10, y: -20, z: -30 },
        color: { x: 0, y: 0, z: 1 },
        intensity: 100,
        die: 0
      }
    ];

    const options: BspSurfaceBindOptions = {
      modelViewProjection: new Float32Array(16),
      dlights: dlights
    };

    pipeline.bind(options);

    expect(gl.uniform1i).toHaveBeenCalledWith('u_numDlights', 2);

    // Check first light
    expect(gl.uniform3f).toHaveBeenCalledWith('u_dlights[0].position', 10, 20, 30);
    expect(gl.uniform3f).toHaveBeenCalledWith('u_dlights[0].color', 1, 0.5, 0);
    expect(gl.uniform1f).toHaveBeenCalledWith('u_dlights[0].intensity', 200);

    // Check second light
    expect(gl.uniform3f).toHaveBeenCalledWith('u_dlights[1].position', -10, -20, -30);
    expect(gl.uniform3f).toHaveBeenCalledWith('u_dlights[1].color', 0, 0, 1);
    expect(gl.uniform1f).toHaveBeenCalledWith('u_dlights[1].intensity', 100);
  });

  it('should cap dlights at MAX_DLIGHTS', () => {
    const dlights: DLight[] = [];
    for (let i = 0; i < 40; i++) {
      dlights.push({
        origin: { x: 0, y: 0, z: 0 },
        color: { x: 1, y: 1, z: 1 },
        intensity: 100,
        die: 0
      });
    }

    const options: BspSurfaceBindOptions = {
      modelViewProjection: new Float32Array(16),
      dlights: dlights
    };

    pipeline.bind(options);

    // Should be capped at 32
    expect(gl.uniform1i).toHaveBeenCalledWith('u_numDlights', 32);
  });
});
