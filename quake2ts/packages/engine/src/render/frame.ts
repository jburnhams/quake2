import { Camera } from './camera.js';
import { BspSurfacePipeline } from './bspPipeline.js';
import { SkyboxPipeline } from './skybox.js';
import { mat4 } from 'gl-matrix';

export interface FrameRenderer {
  renderFrame(camera: Camera): void;
}

export const createFrameRenderer = (
  gl: WebGL2RenderingContext,
  bspPipeline: BspSurfacePipeline,
  skyboxPipeline: SkyboxPipeline
): FrameRenderer => {
  const renderFrame = (camera: Camera) => {
    // 1. Clear buffers
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 2. Update camera/view matrices
    // Placeholder matrices until camera is fixed
    const viewMatrix = mat4.create();
    const projectionMatrix = mat4.create();
    mat4.identity(viewMatrix);
    mat4.identity(projectionMatrix);

    // 3. Traverse BSP, cull, render world
    // TODO: Implement BSP traversal and culling

    // 4. Render skybox
    // TODO: Implement skybox rendering

    // 5. Render models (entities)
    // TODO: Implement model rendering

    // 6. Render particles
    // TODO: Implement particle rendering

    // 7. Render viewmodel
    // TODO: Implement viewmodel rendering

    // 8. Switch to 2D mode, render HUD
    // TODO: Implement HUD rendering
  };

  return {
    renderFrame,
  };
};
