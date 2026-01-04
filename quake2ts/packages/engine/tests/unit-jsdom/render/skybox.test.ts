import { describe, it, expect, vi } from 'vitest';
import {
  removeViewTranslation,
  computeSkyScroll,
  SkyboxPipeline,
} from '../../../src/render/skybox.js';
import { mat4, vec3 } from 'gl-matrix';
import { createMockWebGL2Context } from '@quake2ts/test-utils';
import type { CameraState } from '../../../src/render/types/camera.js';

const { mockLocations } = vi.hoisted(() => {
  return {
    mockLocations: {
      u_viewProjectionNoTranslation: { id: 1 },
      u_scroll: { id: 2 },
      u_skybox: { id: 3 },
    }
  };
});

vi.mock('../../../src/render/shaderProgram.js', () => {
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

vi.mock('../../../src/render/resources.js', () => {
  const VertexArray = class {
    configureAttributes = vi.fn();
    bind = vi.fn();
    dispose = vi.fn();
  };
  const VertexBuffer = class {
    upload = vi.fn();
    dispose = vi.fn();
  };
  const TextureCubeMap = class {
    setParameters = vi.fn();
    bind = vi.fn();
    dispose = vi.fn();
  };

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
    it('should bind uniforms and draw', () => {
      // Use the shared mock instead of defining a partial one locally
      const mockGl = createMockWebGL2Context();

      // Override specific methods needed for this test if the defaults aren't enough
      // But we need to ensure getUniformLocation returns what we expect
      mockGl.getUniformLocation = vi.fn((p, name) => mockLocations[name] || null);

      // Cast to unknown first to treat it as compatible with WebGL2RenderingContext
      const gl = mockGl as unknown as WebGL2RenderingContext;
      const pipeline = new SkyboxPipeline(gl);

      const cameraState: CameraState = {
        position: vec3.create(),
        angles: vec3.create(),
        fov: 90,
        aspect: 1,
        near: 0.1,
        far: 1000,
      };

      const scroll: [number, number] = [0.1, 0.2];

      pipeline.bind({
        cameraState,
        scroll,
      });

      expect(gl.depthMask).toHaveBeenCalledWith(false);

      expect(mockGl.uniformMatrix4fv).toHaveBeenCalledWith(
        mockLocations.u_viewProjectionNoTranslation,
        false,
        expect.anything() // The matrix
      );

      expect(mockGl.uniform2f).toHaveBeenCalledWith(
        mockLocations.u_scroll,
        scroll[0],
        scroll[1]
      );
      expect(mockGl.uniform1i).toHaveBeenCalledWith(mockLocations.u_skybox, 0);

      pipeline.draw();
      expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLES, 0, 36);
    });
  });
});
