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
  `;
}

// ----------------------------------------------------------------------------
// Existing Tests
// ----------------------------------------------------------------------------

test('Skybox: Basic Cubemap', { timeout: 30000 }, async () => {
  // Existing test uses 0,0,0
  await testWebGLRenderer(createSkyboxTestScript(0, 0), {
    name: 'skybox-basic-cubemap',
    description: 'Verifies basic skybox rendering (Front Face - Magenta)',
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
      camera.setRotation(0, 90, 0); // Facing Right (Positive X) -> Red

      // Force update
      const _ = camera.viewMatrix;

      // 2. Setup Skybox Pipeline
      const pipeline = new SkyboxPipeline(gl);

      ${setupColoredCubemapScript}

      // 4. Render
      gl.clearColor(0.5, 0.5, 0.5, 1);
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

// ----------------------------------------------------------------------------
// New Face Tests
// ----------------------------------------------------------------------------

test('Skybox: Face Front (-Z)', { timeout: 30000 }, async () => {
  await testWebGLRenderer(createSkyboxTestScript(0, 0), {
    name: 'skybox-face-front',
    description: 'Expects Magenta face',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: Face Back (+Z)', { timeout: 30000 }, async () => {
  await testWebGLRenderer(createSkyboxTestScript(0, 180), {
    name: 'skybox-face-back',
    description: 'Expects Cyan face',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: Face Right (+X)', { timeout: 30000 }, async () => {
  await testWebGLRenderer(createSkyboxTestScript(0, 90), {
    name: 'skybox-face-right',
    description: 'Expects Red face',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: Face Left (-X)', { timeout: 30000 }, async () => {
  await testWebGLRenderer(createSkyboxTestScript(0, -90), {
    name: 'skybox-face-left',
    description: 'Expects Green face',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: Face Top (+Y)', { timeout: 30000 }, async () => {
  // Pitch -90 usually means looking UP in Quake coordinates
  await testWebGLRenderer(createSkyboxTestScript(-90, 0), {
    name: 'skybox-face-top',
    description: 'Expects Blue face',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: Face Bottom (-Y)', { timeout: 30000 }, async () => {
  // Pitch 90 usually means looking DOWN in Quake coordinates
  await testWebGLRenderer(createSkyboxTestScript(90, 0), {
    name: 'skybox-face-bottom',
    description: 'Expects Yellow face',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

// ----------------------------------------------------------------------------
// Angle Tests (Corners/Edges)
// ----------------------------------------------------------------------------

test('Skybox: Edge View (Right-Front)', { timeout: 30000 }, async () => {
  // Yaw 45: Between Front (0) and Right (90)
  await testWebGLRenderer(createSkyboxTestScript(0, 45), {
    name: 'skybox-angle-edge',
    description: 'Expects split between Red (Right) and Magenta (Front)',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('Skybox: Corner View (Right-Top-Front)', { timeout: 30000 }, async () => {
  // Pitch -45 (Up), Yaw 45 (Right-Front)
  await testWebGLRenderer(createSkyboxTestScript(-45, 45), {
    name: 'skybox-angle-corner',
    description: 'Expects corner of Red (Right), Blue (Top), and Magenta (Front)',
    width: 800,
    height: 600,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});
