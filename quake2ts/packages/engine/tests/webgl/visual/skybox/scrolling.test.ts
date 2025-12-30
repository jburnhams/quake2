import { test } from 'vitest';
import { testWebGLAnimation } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '..', 'visual', '__snapshots__');

test('Skybox: Scrolling Animation', { timeout: 120000 }, async () => {
  await testWebGLAnimation(`
    (async () => {
      // Lazy init of resources
      if (!window.skyboxResources) {
          const { SkyboxPipeline, Camera } = Quake2Engine;

          // Simple mat4 polyfill since we can't import gl-matrix directly in browser
          const mat4 = {
            create: () => new Float32Array(16),
            multiply: (out, a, b) => {
                let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
                let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
                let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
                let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
                let b0  = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
                out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
                out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
                out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
                out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
                b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
                out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
                out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
                out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
                out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
                b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
                out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
                out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
                out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
                out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
                b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
                out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
                out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
                out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
                out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
                return out;
            }
          };

          // 1. Setup Camera
          const camera = new Camera(800 / 600);
          camera.setPosition(0, 0, 0);
          camera.setRotation(0, 0, 0);

          const _ = camera.viewMatrix;

          // 2. Setup Skybox Pipeline
          const pipeline = new SkyboxPipeline(gl);

          // 3. Create a simple textured cubemap
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

          gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

          window.skyboxResources = { pipeline, camera, mat4 };
      }

      const { pipeline, camera, mat4 } = window.skyboxResources;

      // 4. Render with Scroll based on frameIndex
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const viewNoTranslation = new Float32Array(camera.viewMatrix);
      viewNoTranslation[12] = 0;
      viewNoTranslation[13] = 0;
      viewNoTranslation[14] = 0;

      const skyViewProjection = mat4.create();
      mat4.multiply(skyViewProjection, camera.projectionMatrix, viewNoTranslation);

      // Scroll speed: 0.1 per frame
      const scrollX = frameIndex * 0.1;
      const scrollY = frameIndex * 0.05;

      pipeline.bind({
        viewProjection: skyViewProjection,
        scroll: [scrollX, scrollY],
        textureUnit: 0
      });

      pipeline.draw();
    })();
  `, {
    name: 'skybox-scrolling-anim',
    description: 'Verifies skybox scrolling animation over 3 frames',
    width: 800,
    height: 600,
    frameCount: 3,
    fps: 5,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});
