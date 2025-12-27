import { describe, it, expect, vi } from 'vitest';
import {
  removeViewTranslation,
  computeSkyScroll,
  SkyboxPipeline,
} from '../../src/render/skybox.js';
import { mat4 } from 'gl-matrix';

const { mockLocations } = vi.hoisted(() => {
  return {
    mockLocations: {
      u_viewProjectionNoTranslation: { id: 1 },
      u_scroll: { id: 2 },
      u_skybox: { id: 3 },
    }
  };
});

vi.mock('../../src/render/shaderProgram.js', () => {
  const getUniformLocation = vi.fn(
    (name: keyof typeof mockLocations) => mockLocations[name]
  );
  const use = vi.fn();
  const dispose = vi.fn();

  const ShaderProgram = vi.fn(() => ({
    getUniformLocation,
    use,
    dispose,
    sourceSize: 100,
  }));

  ShaderProgram.create = vi.fn(() => ({
    getUniformLocation,
    use,
    dispose,
    sourceSize: 100,
  }));

  return { ShaderProgram };
});

vi.mock('../../src/render/resources.js', () => {
  const VertexArray = vi.fn(() => ({
    configureAttributes: vi.fn(),
    bind: vi.fn(),
    dispose: vi.fn(),
  }));
  const VertexBuffer = vi.fn(() => ({
    upload: vi.fn(),
    dispose: vi.fn(),
  }));
  const TextureCubeMap = vi.fn(() => ({
    setParameters: vi.fn(),
    bind: vi.fn(),
    dispose: vi.fn(),
  }));

  return {
    __esModule: true,
    VertexArray,
    VertexBuffer,
    TextureCubeMap
  };
});

describe('skybox', () => {
  describe('removeViewTranslation', () => {
    it('should remove the translation from a view matrix', () => {
      const viewMatrix = mat4.fromTranslation(mat4.create(), [10, 20, 30]);
      const noTranslation = removeViewTranslation(viewMatrix);
      expect(noTranslation[12]).toBe(0);
      expect(noTranslation[13]).toBe(0);
      expect(noTranslation[14]).toBe(0);
    });
  });

  describe('computeSkyScroll', () => {
    it('should compute sky scroll based on time and default speeds', () => {
      const scroll = computeSkyScroll(1.0);
      expect(scroll).toEqual([0.01, 0.02]);
    });

    it('should compute sky scroll based on time and custom speeds', () => {
      const scroll = computeSkyScroll(2.0, [0.1, 0.2]);
      expect(scroll).toEqual([0.2, 0.4]);
    });
  });

  describe('SkyboxPipeline', () => {
    const createMockGl = (): WebGL2RenderingContext =>
      ({
        uniformMatrix4fv: vi.fn(),
        uniform2f: vi.fn(),
        uniform1i: vi.fn(),
        depthMask: vi.fn(),
        drawArrays: vi.fn(),
        createShader: vi.fn().mockReturnValue({}),
        shaderSource: vi.fn(),
        compileShader: vi.fn(),
        getShaderParameter: vi.fn().mockReturnValue(true),
        deleteShader: vi.fn(),
        createProgram: vi.fn().mockReturnValue({}),
        attachShader: vi.fn(),
        linkProgram: vi.fn(),
        getProgramParameter: vi.fn().mockReturnValue(true),
        bindAttribLocation: vi.fn(),
        createVertexArray: vi.fn().mockReturnValue({}),
        bindVertexArray: vi.fn(),
        deleteVertexArray: vi.fn(),
        createBuffer: vi.fn().mockReturnValue({}),
        bindBuffer: vi.fn(),
        bufferData: vi.fn(),
        deleteBuffer: vi.fn(),
        enableVertexAttribArray: vi.fn(),
        vertexAttribPointer: vi.fn(),
        vertexAttribDivisor: vi.fn(),
        getUniformLocation: vi.fn().mockImplementation((p, name) => mockLocations[name] || {}),
        uniformMatrix4fv: vi.fn(),
        uniform2f: vi.fn(),
        uniform1i: vi.fn(),
        createTexture: vi.fn().mockReturnValue({}),
        bindTexture: vi.fn(),
        texParameteri: vi.fn(),
        texImage2D: vi.fn(),
        activeTexture: vi.fn(),
        deleteTexture: vi.fn(),
        useProgram: vi.fn(),
        TRIANGLES: 0x0004,
      } as any);

    it('should bind uniforms and draw', () => {
      const gl = createMockGl();
      const pipeline = new SkyboxPipeline(gl);

      const viewProjection = mat4.create();
      const scroll: [number, number] = [0.1, 0.2];

      pipeline.bind({
        viewProjection,
        scroll,
      });

      expect(gl.depthMask).toHaveBeenCalledWith(false);
      expect(gl.uniformMatrix4fv).toHaveBeenCalledWith(
        mockLocations.u_viewProjectionNoTranslation,
        false,
        viewProjection
      );
      expect(gl.uniform2f).toHaveBeenCalledWith(
        mockLocations.u_scroll,
        scroll[0],
        scroll[1]
      );
      expect(gl.uniform1i).toHaveBeenCalledWith(mockLocations.u_skybox, 0);

      pipeline.draw();
      expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLES, 0, 36);
    });
  });
});
