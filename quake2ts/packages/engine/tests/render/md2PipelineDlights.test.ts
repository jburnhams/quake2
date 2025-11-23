import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Md2Pipeline, Md2BindOptions } from '../../src/render/md2Pipeline.js';
import { DLight } from '../../src/render/dlight.js';

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
  uniformMatrix4fv: vi.fn(),
  uniform3fv: vi.fn(),
  uniform4fv: vi.fn(),
  uniform1f: vi.fn(),
  uniform1i: vi.fn(),
  uniform3f: vi.fn(),
  deleteProgram: vi.fn(),
  deleteShader: vi.fn(),
} as unknown as WebGL2RenderingContext;

describe('Md2Pipeline', () => {
  let pipeline: Md2Pipeline;

  beforeEach(() => {
    vi.clearAllMocks();
    pipeline = new Md2Pipeline(gl);
  });

  it('should bind dlights correctly', () => {
    const dlights: DLight[] = [
      {
        origin: { x: 10, y: 20, z: 30 },
        color: { x: 1, y: 0.5, z: 0 },
        intensity: 200,
        die: 0
      }
    ];

    const options: Md2BindOptions = {
      modelViewProjection: new Float32Array(16),
      dlights: dlights
    };

    pipeline.bind(options);

    expect(gl.uniform1i).toHaveBeenCalledWith('u_numDlights', 1);
    expect(gl.uniform3f).toHaveBeenCalledWith('u_dlights[0].position', 10, 20, 30);
    expect(gl.uniform3f).toHaveBeenCalledWith('u_dlights[0].color', 1, 0.5, 0);
    expect(gl.uniform1f).toHaveBeenCalledWith('u_dlights[0].intensity', 200);
  });

  it('should bind modelMatrix if provided', () => {
    const modelMatrix = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const options: Md2BindOptions = {
        modelViewProjection: new Float32Array(16),
        modelMatrix: modelMatrix
    };

    pipeline.bind(options);

    expect(gl.uniformMatrix4fv).toHaveBeenCalledWith('u_modelMatrix', false, modelMatrix);
  });

  it('should bind identity modelMatrix if not provided', () => {
    const options: Md2BindOptions = {
        modelViewProjection: new Float32Array(16),
    };

    pipeline.bind(options);

    // Check that it was called with something that looks like identity
    expect(gl.uniformMatrix4fv).toHaveBeenCalledWith('u_modelMatrix', false, expect.any(Float32Array));
  });
});
