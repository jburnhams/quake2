/**
 * Comprehensive camera angle tests for WebGL renderer
 *
 * Tests all major camera orientations to ensure correct matrix building
 * and coordinate transformations. Mirrors the WebGPU camera-angles test.
 */
import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '__snapshots__');

// Same camera positions as WebGPU test for consistency
const CAMERA_TEST_POSITIONS = [
  { pos: [0, 0, 50], angles: [0, 0, 0], label: 'origin-forward' },
  { pos: [0, 0, 50], angles: [45, 0, 0], label: 'origin-down' },
  { pos: [0, 0, 50], angles: [-45, 0, 0], label: 'origin-up' },
  { pos: [0, 0, 50], angles: [0, 45, 0], label: 'origin-right' },
  { pos: [0, 0, 50], angles: [0, -45, 0], label: 'origin-left' },
  { pos: [0, 0, 50], angles: [45, 45, 0], label: 'origin-diagonal-pos' },
  { pos: [0, 0, 50], angles: [-45, -45, 0], label: 'origin-diagonal-neg' },
  { pos: [0, 0, 50], angles: [30, 135, 0], label: 'origin-oblique' },
  { pos: [0, 0, 50], angles: [0, 90, 0], label: 'origin-right-90' },
  { pos: [0, 0, 50], angles: [0, 180, 0], label: 'origin-back' },
  { pos: [0, 0, 50], angles: [0, 270, 0], label: 'origin-left-90' },
  { pos: [0, 0, 50], angles: [90, 0, 0], label: 'origin-straight-down' },
  { pos: [0, 0, 50], angles: [-90, 0, 0], label: 'origin-straight-up' },
];

// Helper script to setup a colored cubemap
const setupColoredCubemapScript = `
  // Create a colored cubemap with distinctive colors for each face
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

function createCameraAngleTestScript(pos: number[], angles: number[]) {
  return `
    (async () => {
      const { SkyboxPipeline, Camera } = Quake2Engine;

      // Setup Camera
      const camera = new Camera(256 / 256);
      camera.setPosition(${pos[0]}, ${pos[1]}, ${pos[2]});
      camera.setRotation(${angles[0]}, ${angles[1]}, ${angles[2]});

      // Force update
      const _ = camera.viewMatrix;

      // Setup Skybox Pipeline
      const pipeline = new SkyboxPipeline(gl);

      ${setupColoredCubemapScript}

      // Render
      gl.clearColor(0, 0, 0, 1); // Black background
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      pipeline.bind({
        cameraState: camera.toState(),
        scroll: [0, 0],
        textureUnit: 0
      });

      pipeline.draw();

      pipeline.dispose();
    })();
  `;
}

// Generate tests for each camera position
for (const { pos, angles, label } of CAMERA_TEST_POSITIONS) {
  test(`WebGL: Camera angle ${label} (pitch=${angles[0]}, yaw=${angles[1]}, roll=${angles[2]})`,
    { timeout: 30000 },
    async () => {
      await testWebGLRenderer(createCameraAngleTestScript(pos, angles), {
        name: `camera-${label}`,
        description: `Verifies WebGL camera rendering at ${label}`,
        width: 256,
        height: 256,
        snapshotDir
      });
    }
  );
}
