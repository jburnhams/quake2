import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

// Helper script to setup a colored cubemap
const setupColoredCubemapScript = `
      // 3. Create a colored cubemap
      // We'll create distinct colors for each face to verify orientation
      const size = 1;
      const faces = [
        [255, 0, 0, 255],   // POSITIVE_X (Right) - Red
        [0, 255, 0, 255],   // NEGATIVE_X (Left) - Green
        [0, 0, 255, 255],   // POSITIVE_Y (Top) - Blue
        [255, 255, 0, 255], // NEGATIVE_Y (Bottom) - Yellow
        [128, 0, 128, 255], // POSITIVE_Z (Back) - Purple (Changed from Cyan to distinguish from Green if Blue is lost)
        [255, 128, 0, 255], // NEGATIVE_Z (Front) - Orange (Changed from Magenta to distinguish from Red if Blue is lost)
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

const mat4Polyfill = `
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
`;

function createSkyboxTestScript(pitch: number, yaw: number) {
  return `
    (async () => {
      const { SkyboxPipeline, Camera } = Quake2Engine;
      ${mat4Polyfill}

      // 1. Setup Camera
      const camera = new Camera(800 / 600);
      camera.setPosition(0, 0, 0);
      camera.setRotation(${pitch}, ${yaw}, 0);

      // Force update
      const _ = camera.viewMatrix;

      // 2. Setup Skybox Pipeline
      const pipeline = new SkyboxPipeline(gl);

      ${setupColoredCubemapScript}

      // 4. Render
      gl.clearColor(0.5, 0.5, 0.5, 1); // Gray background
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

// ----------------------------------------------------------------------------
// Existing Tests
// ----------------------------------------------------------------------------

test('Skybox: Basic Cubemap', { timeout: 30000 }, async () => {
  // Existing test uses 0,0,0
  await testWebGLRenderer(createSkyboxTestScript(0, 0), {
    name: 'skybox-basic-cubemap',
    description: 'Verifies basic skybox rendering (Front Face - Orange)',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: No Translation', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    (async () => {
      const { SkyboxPipeline, Camera } = Quake2Engine;
      ${mat4Polyfill}

      // 1. Setup Camera at a large offset
      const camera = new Camera(800 / 600);
      camera.setPosition(10000, 10000, 10000); // Large offset
      camera.setRotation(0, 90, 0); // Yaw 90 -> Left (+Y) -> Green

      // Force update
      const _ = camera.viewMatrix;

      // 2. Setup Skybox Pipeline
      const pipeline = new SkyboxPipeline(gl);

      ${setupColoredCubemapScript}

      // 4. Render
      gl.clearColor(0.5, 0.5, 0.5, 1);
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
    name: 'skybox-no-translation',
    description: 'Verifies skybox appears same despite camera position (infinite distance)',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

// ----------------------------------------------------------------------------
// New Face Tests
// ----------------------------------------------------------------------------

test('Skybox: Face Forward (+X)', { timeout: 30000 }, async () => {
  await testWebGLRenderer(createSkyboxTestScript(0, 0), {
    name: 'skybox-face-front', // Keeping original filename to avoid churn, but desc update
    description: 'Expects Orange face (Forward)',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: Face Backward (-X)', { timeout: 30000 }, async () => {
  await testWebGLRenderer(createSkyboxTestScript(0, 180), {
    name: 'skybox-face-back',
    description: 'Expects Purple face (Backward)',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: Face Left (+Y)', { timeout: 30000 }, async () => {
  // Yaw 90 is Left
  await testWebGLRenderer(createSkyboxTestScript(0, 90), {
    name: 'skybox-face-left',
    description: 'Expects Green face (Left)',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: Face Right (-Y)', { timeout: 30000 }, async () => {
  // Yaw -90 is Right
  await testWebGLRenderer(createSkyboxTestScript(0, -90), {
    name: 'skybox-face-right',
    description: 'Expects Red face (Right)',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: Face Up (+Z)', { timeout: 30000 }, async () => {
  // Pitch -90 usually means looking UP in Quake coordinates
  await testWebGLRenderer(createSkyboxTestScript(-90, 0), {
    name: 'skybox-face-top',
    description: 'Expects Blue face (Top)',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: Face Down (-Z)', { timeout: 30000 }, async () => {
  // Pitch 90 usually means looking DOWN in Quake coordinates
  await testWebGLRenderer(createSkyboxTestScript(90, 0), {
    name: 'skybox-face-bottom',
    description: 'Expects Yellow face (Bottom)',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

// ----------------------------------------------------------------------------
// Angle Tests (Corners/Edges)
// ----------------------------------------------------------------------------

test('Skybox: Edge View (Left-Front)', { timeout: 30000 }, async () => {
  // Yaw 44: Between Front (0) and Left (90)
  // Quake Angle 44 is Left-Front (between +X and +Y)
  // +X maps to Front (Orange)
  // +Y maps to Left (Green)
  // So 44 should show Orange/Green seam.
  // Note: Using 44 instead of 45 to avoid numerical precision issues when
  // cube vertices land exactly at z=0 in view space at exact 45-degree angles.
  await testWebGLRenderer(createSkyboxTestScript(0, 44), {
    name: 'skybox-angle-edge',
    description: 'Expects split between Orange (Front) and Green (Left)',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: Corner View (Left-Top-Front)', { timeout: 30000 }, async () => {
  // Pitch -45 (Up), Yaw 45 (Left-Front)
  // Should see split between:
  // Front (Orange), Left (Green), Top (Blue)
  await testWebGLRenderer(createSkyboxTestScript(-45, 45), {
    name: 'skybox-angle-corner',
    description: 'Expects corner of Orange (Front), Green (Left), and Blue (Top)',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});
