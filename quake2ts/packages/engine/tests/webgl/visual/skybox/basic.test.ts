import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

// Helper script to setup a colored cubemap
// This logic is shared between tests to avoid duplication in the injected code string.
const setupColoredCubemapScript = `
      // 3. Create a colored cubemap
      // We'll create distinct colors for each face to verify orientation
      const size = 1;
      const faces = [
        [255, 0, 0, 255],   // POSITIVE_X (Right) - Red
        [0, 255, 0, 255],   // NEGATIVE_X (Left) - Green
        [0, 0, 255, 255],   // POSITIVE_Y (Top) - Blue
        [255, 255, 0, 255], // NEGATIVE_Y (Bottom) - Yellow
        [0, 255, 255, 255], // POSITIVE_Z (Back) - Cyan
        [255, 0, 255, 255], // NEGATIVE_Z (Front) - Magenta
      ];

      const targets = [
        gl.TEXTURE_CUBE_MAP_POSITIVE_X,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
      ];

      pipeline.cubemap.bind(0);

      faces.forEach((color, i) => {
        const level = 0;
        const internalFormat = gl.RGBA;
        const width = size;
        const height = size;
        const border = 0;
        const format = gl.RGBA;
        const type = gl.UNSIGNED_BYTE;
        const data = new Uint8Array(color);
        gl.texImage2D(targets[i], level, internalFormat, width, height, border, format, type, data);
      });
`;

test('Skybox: Basic Cubemap', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    // Wrap async imports in an IIFE to allow top-level await behavior
    (async () => {
      const { SkyboxPipeline } = await import('/packages/engine/src/render/skybox.ts');
      const { Camera } = await import('/packages/engine/src/render/camera.ts');
      const { mat4 } = await import('gl-matrix');

      // 1. Setup Camera
      const camera = new Camera(800 / 600);
      camera.setPosition([0, 0, 0]);
      camera.setAngles([0, 0, 0]); // Facing forward
      camera.updateMatrices();

      // 2. Setup Skybox Pipeline
      const pipeline = new SkyboxPipeline(gl);

      ${setupColoredCubemapScript}

      // 4. Render
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Remove translation manually for skybox rendering test (simulating renderSky)
      const viewNoTranslation = new Float32Array(camera.viewMatrix);
      viewNoTranslation[12] = 0;
      viewNoTranslation[13] = 0;
      viewNoTranslation[14] = 0;

      const skyViewProjection = mat4.create();
      mat4.multiply(skyViewProjection, camera.projectionMatrix, viewNoTranslation);

      pipeline.bind({
        viewProjection: skyViewProjection,
        scroll: [0, 0],
        textureUnit: 0
      });

      pipeline.draw();

      pipeline.dispose();
    })();
  `, {
    name: 'skybox-basic-cubemap',
    description: 'Verifies basic skybox rendering with distinct colored faces',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: No Translation', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    (async () => {
      const { SkyboxPipeline } = await import('/packages/engine/src/render/skybox.ts');
      const { Camera } = await import('/packages/engine/src/render/camera.ts');
      const { mat4 } = await import('gl-matrix');

      // 1. Setup Camera at a large offset
      const camera = new Camera(800 / 600);
      camera.setPosition([10000, 10000, 10000]); // Large offset
      camera.setAngles([0, 90, 0]); // Facing Right (Positive X) -> Should see Red face
      camera.updateMatrices();

      // 2. Setup Skybox Pipeline
      const pipeline = new SkyboxPipeline(gl);

      ${setupColoredCubemapScript}

      // 4. Render
      gl.clearColor(0.5, 0.5, 0.5, 1); // Gray background to detect holes
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Simulate renderSky logic which removes translation
      const viewNoTranslation = new Float32Array(camera.viewMatrix);
      viewNoTranslation[12] = 0;
      viewNoTranslation[13] = 0;
      viewNoTranslation[14] = 0;

      const skyViewProjection = mat4.create();
      mat4.multiply(skyViewProjection, camera.projectionMatrix, viewNoTranslation);

      pipeline.bind({
        viewProjection: skyViewProjection,
        scroll: [0, 0],
        textureUnit: 0
      });

      pipeline.draw();

      pipeline.dispose();
    })();
  `, {
    name: 'skybox-no-translation',
    description: 'Verifies skybox appears same despite camera position (infinite distance)',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});
