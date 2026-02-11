import { describe, test, expect } from 'vitest';
import { Camera } from '../../../src/render/camera.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';
import { createFrameRenderer } from '../../../src/render/frame.js';
import type { BspSurfacePipeline } from '../../../src/render/bspPipeline.js';
import type { SkyboxPipeline } from '../../../src/render/skybox.js';

describe('CameraState Integration', () => {
  test('WebGL renderer ignores cameraState (legacy)', () => {
    const gl = createMockWebGL2Context() as unknown as WebGL2RenderingContext;
    const bspPipeline = {
      bind: () => ({}),
      draw: () => {}
    } as unknown as BspSurfacePipeline;
    const skyboxPipeline = {
      bind: () => {},
      draw: () => {},
      gl: { depthMask: () => {} }
    } as unknown as SkyboxPipeline;
    const deps = {
        gatherVisibleFaces: () => [],
        extractFrustumPlanes: () => [],
        computeSkyScroll: () => [0, 0],
        removeViewTranslation: () => new Float32Array(16)
    } as any;

    const renderer = createFrameRenderer(gl, bspPipeline, skyboxPipeline, deps);
    const camera = new Camera();
    const cameraState = camera.toState();

    // Should not throw, should use camera.viewMatrix (which is tested in frame.test.ts indirectly)
    const stats = renderer.renderFrame({
      camera,
      cameraState,
      timeSeconds: 0
    });

    expect(stats).toBeDefined();
  });
});
