/**
 * Feature combination tests for WebGL renderer
 *
 * Tests different combinations of rendering features to ensure
 * CameraState works correctly in various scenarios.
 */
import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '__snapshots__');

// Helper script to setup a colored cubemap
const setupColoredCubemapScript = `
  const size = 1;
  const faces = [
    [255, 0, 255, 255],   // POSITIVE_X (Right) - Magenta
    [0, 255, 0, 255],     // NEGATIVE_X (Left) - Green
    [0, 0, 255, 255],     // POSITIVE_Y (Top) - Blue
    [255, 255, 0, 255],   // NEGATIVE_Y (Bottom) - Yellow
    [0, 255, 255, 255],   // POSITIVE_Z (Front) - Cyan
    [255, 0, 0, 255]      // NEGATIVE_Z (Back) - Red
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

  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
`;

// Helper script to setup a grayscale cubemap
const setupGrayscaleCubemapScript = `
  const size = 1;
  const faces = [
    [200, 200, 200, 255], // POSITIVE_X (Light gray)
    [150, 150, 150, 255], // NEGATIVE_X (Medium gray)
    [100, 100, 100, 255], // POSITIVE_Y (Dark gray)
    [180, 180, 180, 255], // NEGATIVE_Y (Gray)
    [160, 160, 160, 255], // POSITIVE_Z (Gray)
    [120, 120, 120, 255]  // NEGATIVE_Z (Gray)
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

  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
`;

test('WebGL: skybox-only colored cubemap', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    (async () => {
      const { SkyboxPipeline, Camera } = Quake2Engine;

      const camera = new Camera(256 / 256);
      camera.setPosition(0, 0, 50);
      camera.setRotation(0, 0, 0);
      const _ = camera.viewMatrix;

      const pipeline = new SkyboxPipeline(gl);
      ${setupColoredCubemapScript}

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      pipeline.bind({
        cameraState: camera.toState(),
        scroll: [0, 0],
        textureUnit: 0
      });

      pipeline.draw();
      pipeline.dispose();
    })();
  `, {
    name: 'features-skybox-only',
    description: 'Skybox only with colored cubemap',
    width: 256,
    height: 256,
    snapshotDir
  });
});

test('WebGL: skybox-grayscale monochrome environment', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    (async () => {
      const { SkyboxPipeline, Camera } = Quake2Engine;

      const camera = new Camera(256 / 256);
      camera.setPosition(0, 0, 50);
      camera.setRotation(45, 45, 0); // Diagonal view
      const _ = camera.viewMatrix;

      const pipeline = new SkyboxPipeline(gl);
      ${setupGrayscaleCubemapScript}

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      pipeline.bind({
        cameraState: camera.toState(),
        scroll: [0, 0],
        textureUnit: 0
      });

      pipeline.draw();
      pipeline.dispose();
    })();
  `, {
    name: 'features-skybox-grayscale',
    description: 'Grayscale skybox with diagonal view',
    width: 256,
    height: 256,
    snapshotDir
  });
});

test('WebGL: wide-fov skybox rendering', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    (async () => {
      const { SkyboxPipeline, Camera } = Quake2Engine;

      const camera = new Camera(256 / 256);
      camera.setPosition(0, 0, 50);
      camera.setRotation(0, 0, 0);
      camera.fov = 120; // Wide FOV
      const _ = camera.viewMatrix;

      const pipeline = new SkyboxPipeline(gl);
      ${setupColoredCubemapScript}

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      pipeline.bind({
        cameraState: camera.toState(),
        scroll: [0, 0],
        textureUnit: 0
      });

      pipeline.draw();
      pipeline.dispose();
    })();
  `, {
    name: 'features-wide-fov',
    description: 'Skybox with wide field of view (120 degrees)',
    width: 256,
    height: 256,
    snapshotDir
  });
});

test('WebGL: narrow-fov skybox rendering', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    (async () => {
      const { SkyboxPipeline, Camera } = Quake2Engine;

      const camera = new Camera(256 / 256);
      camera.setPosition(0, 0, 50);
      camera.setRotation(0, 45, 0);
      camera.fov = 45; // Narrow FOV
      const _ = camera.viewMatrix;

      const pipeline = new SkyboxPipeline(gl);
      ${setupColoredCubemapScript}

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      pipeline.bind({
        cameraState: camera.toState(),
        scroll: [0, 0],
        textureUnit: 0
      });

      pipeline.draw();
      pipeline.dispose();
    })();
  `, {
    name: 'features-narrow-fov',
    description: 'Skybox with narrow field of view (45 degrees)',
    width: 256,
    height: 256,
    snapshotDir
  });
});

test('WebGL: aspect-ratio non-square viewport', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    (async () => {
      const { SkyboxPipeline, Camera } = Quake2Engine;

      const camera = new Camera(320 / 240); // 4:3 aspect ratio
      camera.setPosition(0, 0, 50);
      camera.setRotation(0, 0, 0);
      const _ = camera.viewMatrix;

      const pipeline = new SkyboxPipeline(gl);
      ${setupColoredCubemapScript}

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      pipeline.bind({
        cameraState: camera.toState(),
        scroll: [0, 0],
        textureUnit: 0
      });

      pipeline.draw();
      pipeline.dispose();
    })();
  `, {
    name: 'features-aspect-ratio',
    description: 'Skybox with 4:3 aspect ratio viewport',
    width: 320,
    height: 240,
    snapshotDir
  });
});
