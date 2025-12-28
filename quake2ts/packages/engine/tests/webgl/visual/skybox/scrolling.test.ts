import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('Skybox: Scrolling (Horizontal/Vertical)', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    (async () => {
      const { SkyboxPipeline } = await import('/packages/engine/src/render/skybox.ts');
      const { Camera } = await import('/packages/engine/src/render/camera.ts');
      const { mat4 } = await import('gl-matrix');

      // 1. Setup Camera
      const camera = new Camera(800 / 600);
      camera.setPosition([0, 0, 0]);
      camera.setAngles([0, 0, 0]);
      camera.updateMatrices();

      // 2. Setup Skybox Pipeline
      const pipeline = new SkyboxPipeline(gl);

      // 3. Create a simple textured cubemap (grid pattern to see scrolling)
      const size = 32;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0000FF'; // Blue background
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#FFFFFF'; // White center
        ctx.fillRect(size/4, size/4, size/2, size/2);
      }

      const targets = [
        gl.TEXTURE_CUBE_MAP_POSITIVE_X,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
      ];

      pipeline.cubemap.bind(0);
      targets.forEach((target) => {
         gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      });
      // We need mimaps for correct sampling if minFilter is not linear
      // but SkyboxPipeline sets LINEAR/LINEAR/CLAMP_TO_EDGE by default, so we are fine.

      // 4. Render with Scroll
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const viewNoTranslation = new Float32Array(camera.viewMatrix);
      viewNoTranslation[12] = 0;
      viewNoTranslation[13] = 0;
      viewNoTranslation[14] = 0;

      const skyViewProjection = mat4.create();
      mat4.multiply(skyViewProjection, camera.projectionMatrix, viewNoTranslation);

      // Scroll of [0.5, 0.25] should shift the texture
      // The shader does: dir.xy += u_scroll;
      // This is a simple vertex-based shift (shifting the lookup vector)
      // It effectively rotates the skybox around the Z axis (if scrolling X)
      // or tilts it (if scrolling Y), but strictly speaking it just offsets the lookup vector.
      // This matches Quake 2's simple sky scrolling.

      pipeline.bind({
        viewProjection: skyViewProjection,
        scroll: [0.5, 0.25],
        textureUnit: 0
      });

      pipeline.draw();

      pipeline.dispose();
    })();
  `, {
    name: 'skybox-scrolling', // Removed extension
    description: 'Verifies skybox scrolling uniform application',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});
