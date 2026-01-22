/**
 * Visual test for camera pitch/yaw rotation order bug
 *
 * This test demonstrates the issue where looking up/down after turning left/right
 * causes diagonal rotation instead of keeping the horizon level.
 *
 * Expected behavior:
 * - After turning left 90 degrees, looking up/down should tilt vertically only
 * - The horizon should remain level regardless of yaw angle
 *
 * Bug behavior:
 * - After turning left 90 degrees, looking up/down causes diagonal rotation
 * - The horizon tilts when it should stay level
 */
import { test } from 'vitest';
import { testWebGLAnimation } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '__snapshots__');

// Animation sequence:
// Frame 0-9: Turn left from yaw=0 to yaw=90 (pitch=0)
// Frame 10-19: Look up from pitch=0 to pitch=-45 (yaw=90)
// Frame 20-29: Look down from pitch=-45 to pitch=45 (yaw=90)
// Frame 30-39: Return to center pitch=0 (yaw=90)
const FRAME_COUNT = 40;

// Helper script to setup a colored cubemap for skybox
const setupColoredCubemapScript = `
  // Create a colored cubemap with distinctive colors for each face
  // This makes it easy to see orientation and rotation
  const size = 1;
  const faces = [
    [255, 0, 255, 255],   // POSITIVE_X (Right/East) - Magenta
    [0, 255, 0, 255],     // NEGATIVE_X (Left/West) - Green
    [0, 0, 255, 255],     // POSITIVE_Y (Top) - Blue
    [255, 255, 0, 255],   // NEGATIVE_Y (Bottom) - Yellow
    [0, 255, 255, 255],   // POSITIVE_Z (Front/North) - Cyan
    [255, 0, 0, 255]      // NEGATIVE_Z (Back/South) - Red
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

// Calculate pitch and yaw for each frame
function calculateAnglesForFrame(frameIndex: number): { pitch: number; yaw: number } {
  if (frameIndex < 10) {
    // Phase 1: Turn left (yaw 0 to 90)
    const t = frameIndex / 9;
    return { pitch: 0, yaw: t * 90 };
  } else if (frameIndex < 20) {
    // Phase 2: Look up (pitch 0 to -45)
    const t = (frameIndex - 10) / 9;
    return { pitch: t * -45, yaw: 90 };
  } else if (frameIndex < 30) {
    // Phase 3: Look down (pitch -45 to 45)
    const t = (frameIndex - 20) / 9;
    return { pitch: -45 + t * 90, yaw: 90 };
  } else {
    // Phase 4: Return to center (pitch 45 to 0)
    const t = (frameIndex - 30) / 9;
    return { pitch: 45 - t * 45, yaw: 90 };
  }
}

// Create the render code that uses frameIndex
const renderCode = `
  (async () => {
    const { SkyboxPipeline, Camera } = Quake2Engine;

    // Calculate angles based on frame index
    const frameAngles = (() => {
      if (frameIndex < 10) {
        const t = frameIndex / 9;
        return { pitch: 0, yaw: t * 90 };
      } else if (frameIndex < 20) {
        const t = (frameIndex - 10) / 9;
        return { pitch: t * -45, yaw: 90 };
      } else if (frameIndex < 30) {
        const t = (frameIndex - 20) / 9;
        return { pitch: -45 + t * 90, yaw: 90 };
      } else {
        const t = (frameIndex - 30) / 9;
        return { pitch: 45 - t * 45, yaw: 90 };
      }
    })();

    // Setup Camera
    const camera = new Camera(256 / 256);
    camera.setPosition(0, 0, 50);
    camera.setRotation(frameAngles.pitch, frameAngles.yaw, 0);

    // Force update
    const _ = camera.viewMatrix;

    // Setup Skybox Pipeline
    const pipeline = new SkyboxPipeline(gl);

    ${setupColoredCubemapScript}

    // Render
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    pipeline.bind({
      cameraState: camera.toState(),
      scroll: [0, 0],
      textureUnit: 0
    });

    pipeline.draw();

    // Draw reference lines to show horizon level
    // These should help visualize if the horizon is tilted
    renderer.begin2D();

    // Draw horizontal reference line in the center (should match horizon if level)
    renderer.drawfillRect(0, 127, 256, 2, [1, 1, 1, 0.5]);

    // Draw vertical center line
    renderer.drawfillRect(127, 0, 2, 256, [1, 1, 1, 0.3]);

    // Display current angles
    const angleText = 'P:' + frameAngles.pitch.toFixed(0) + ' Y:' + frameAngles.yaw.toFixed(0);
    renderer.drawString(4, 4, angleText, [1, 1, 1, 1]);

    // Display phase
    let phase = '';
    if (frameIndex < 10) phase = 'TURNING LEFT';
    else if (frameIndex < 20) phase = 'LOOKING UP';
    else if (frameIndex < 30) phase = 'LOOKING DOWN';
    else phase = 'CENTERING';
    renderer.drawString(4, 16, phase, [1, 1, 0, 1]);

    renderer.end2D();

    pipeline.dispose();
  })();
`;

test('WebGL: Camera pitch/yaw rotation order (animation)', { timeout: 60000 }, async () => {
  await testWebGLAnimation(renderCode, {
    name: 'camera-pitch-yaw-rotation',
    description: 'Tests pitch/yaw rotation order - horizon should stay level when looking up/down after turning',
    width: 256,
    height: 256,
    frameCount: FRAME_COUNT,
    fps: 10,
    snapshotDir,
    maxDifferencePercent: 1.0 // Allow some tolerance for antialiasing
  });
});

// Also create static tests at key positions to make comparison easier
const KEY_POSITIONS = [
  { pitch: 0, yaw: 0, label: 'forward-level', desc: 'Looking forward, horizon level' },
  { pitch: 0, yaw: 90, label: 'left90-level', desc: 'Turned left 90, horizon should be level' },
  { pitch: -45, yaw: 90, label: 'left90-lookup', desc: 'Turned left 90, looking up 45 - horizon should be level' },
  { pitch: 45, yaw: 90, label: 'left90-lookdown', desc: 'Turned left 90, looking down 45 - horizon should be level' },
];

function createStaticTestScript(pitch: number, yaw: number) {
  return `
    (async () => {
      const { SkyboxPipeline, Camera } = Quake2Engine;

      // Setup Camera
      const camera = new Camera(256 / 256);
      camera.setPosition(0, 0, 50);
      camera.setRotation(${pitch}, ${yaw}, 0);

      // Force update
      const _ = camera.viewMatrix;

      // Setup Skybox Pipeline
      const pipeline = new SkyboxPipeline(gl);

      ${setupColoredCubemapScript}

      // Render
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      pipeline.bind({
        cameraState: camera.toState(),
        scroll: [0, 0],
        textureUnit: 0
      });

      pipeline.draw();

      // Draw reference lines
      renderer.begin2D();

      // Horizontal reference line at center
      renderer.drawfillRect(0, 127, 256, 2, [1, 1, 1, 0.5]);

      // Vertical center line
      renderer.drawfillRect(127, 0, 2, 256, [1, 1, 1, 0.3]);

      // Display angles
      renderer.drawString(4, 4, 'Pitch: ${pitch}', [1, 1, 1, 1]);
      renderer.drawString(4, 16, 'Yaw: ${yaw}', [1, 1, 1, 1]);

      renderer.end2D();

      pipeline.dispose();
    })();
  `;
}

// Generate static tests for key positions
for (const { pitch, yaw, label, desc } of KEY_POSITIONS) {
  test(`WebGL: Camera pitch/yaw static - ${label}`, { timeout: 30000 }, async () => {
    const { testWebGLRenderer } = await import('@quake2ts/test-utils');
    await testWebGLRenderer(createStaticTestScript(pitch, yaw), {
      name: `camera-pitch-yaw-${label}`,
      description: desc,
      width: 256,
      height: 256,
      snapshotDir
    });
  });
}
