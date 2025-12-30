import { test } from 'vitest';
import { testWebGLRenderer, createTestBspMap } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';
import { SURF_WARP } from '@quake2ts/shared';

// Setup snapshot directory path relative to this file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '__snapshots__');

// Helper to serialize BspMap for browser injection
function serializeBspMap(bspMap: any) {
  const replacer = (key: string, value: any) => {
    if (typeof value === 'function') return undefined;
    if (ArrayBuffer.isView(value)) {
        return Array.from(value as any);
    }
    return value;
  };
  return JSON.stringify(bspMap, replacer);
}

// Polyfill for mat4 in browser context
const mat4Polyfill = `
    const mat4 = {
        create: () => new Float32Array(16),
        lookAt: (out, eye, center, up) => { return out; }
    };
    window.mat4 = mat4;
`;

// Helper script to inject mat4
function getPolyfills() {
    return mat4Polyfill;
}

test('warp: basic water surface at t=0', { timeout: 30000 }, async () => {
  // 1. Create the BSP map with SURF_WARP flag in Node
  const bspMap = createTestBspMap({
    surfaces: [
      {
        vertices: [
          [-64, 0, -64],
          [ 64, 0, -64],
          [ 64, 0,  64],
          [-64, 0,  64]
        ],
        texInfo: {
            texture: 'water1',
            flags: SURF_WARP
        },
        styles: [0, 0, 0, 0] // No lightmap styles
      }
    ]
  });

  const serializedBsp = serializeBspMap(bspMap);

  await testWebGLRenderer(`
    ${getPolyfills()}

    // Reconstruct BspMap from injected JSON
    const bspData = ${serializedBsp};
    bspData.surfEdges = new Int32Array(bspData.surfEdges);
    bspData.lightMaps = new Uint8Array(bspData.lightMaps);

    // Ensure methods expected by renderer exist
    if (bspData.leafs.length > 0) {
        bspData.findLeaf = () => bspData.leafs[0];
        bspData.leafs[0].area = -1; // Avoid area visibility logic issues
    } else {
        bspData.findLeaf = () => null;
    }

    // Create camera using Quake2Engine.Camera
    const { Camera, Texture2D } = Quake2Engine;
    const camera = new Camera(1.0);
    camera.setPosition(0, 150, 0);
    camera.setRotation(0, -90, 0); // Look down at the surface

    // Create a water texture
    const size = 64;
    const pixels = new Uint8ClampedArray(size * size * 4);
    for(let y=0; y<size; y++) {
        for(let x=0; x<size; x++) {
            const i = (y * size + x) * 4;
            // Grid pattern to verify warp
            const isGrid = (x % 8 === 0) || (y % 8 === 0);
            pixels[i] = isGrid ? 0 : 0;
            pixels[i+1] = isGrid ? 0 : 50;
            pixels[i+2] = isGrid ? 255 : 200;
            pixels[i+3] = 255;
        }
    }
    const textureData = new ImageData(pixels, size, size);

    // Create Texture2D instance and upload data
    const waterTexture = new Texture2D(gl);
    waterTexture.upload(size, size, textureData);

    // Create a map for the renderer to find the texture
    const textureMap = new Map();
    textureMap.set('water1', waterTexture);

    const result = renderer.uploadBspGeometry(bspData);

    renderer.renderFrame({
      camera,
      world: {
        map: bspData,
        surfaces: result.surfaces,
        textures: textureMap
      },
      timeSeconds: 0.0,
      clearColor: [0.2, 0.2, 0.2, 1.0]
    }, []); // Pass empty entities array to avoid 'de is not iterable'
  `, {
    name: 'warp-water-t0',
    description: 'Water surface with warp distortion at time=0',
    width: 256,
    height: 256,
    snapshotDir
  });
});

test('warp: animated water over time', { timeout: 30000 }, async () => {
    // 1. Create the BSP map with SURF_WARP flag in Node
    const bspMap = createTestBspMap({
      surfaces: [
        {
          vertices: [
            [-64, 0, -64],
            [ 64, 0, -64],
            [ 64, 0,  64],
            [-64, 0,  64]
          ],
          texInfo: {
              texture: 'water1',
              flags: SURF_WARP
          },
          styles: [0, 0, 0, 0]
        }
      ]
    });

    const serializedBsp = serializeBspMap(bspMap);

    await testWebGLRenderer(`
      ${getPolyfills()}

      const bspData = ${serializedBsp};
      bspData.surfEdges = new Int32Array(bspData.surfEdges);
      bspData.lightMaps = new Uint8Array(bspData.lightMaps);
      if (bspData.leafs.length > 0) {
          bspData.findLeaf = () => bspData.leafs[0];
          bspData.leafs[0].area = -1;
      } else {
          bspData.findLeaf = () => null;
      }

      const { Camera, Texture2D } = Quake2Engine;
      const camera = new Camera(1.0);
      camera.setPosition(0, 150, 0);
      camera.setRotation(0, -90, 0);

      // Create texture
      const size = 64;
      const pixels = new Uint8ClampedArray(size * size * 4);
      for(let i=0; i<size*size*4; i+=4) {
          pixels[i] = 0; pixels[i+1] = 50; pixels[i+2] = 200; pixels[i+3] = 255;
          const p = i/4;
          const x = p % size;
          const y = Math.floor(p / size);
          if (x%8===0 || y%8===0) { pixels[i]=255; pixels[i+1]=255; pixels[i+2]=255; }
      }
      const textureData = new ImageData(pixels, size, size);

      const waterTexture = new Texture2D(gl);
      waterTexture.upload(size, size, textureData);

      const textureMap = new Map();
      textureMap.set('water1', waterTexture);

      const result = renderer.uploadBspGeometry(bspData);

      const times = [0.0, 1.0, 2.0];

      for (let i = 0; i < times.length; i++) {
        const x = i * 256;
        gl.viewport(x, 0, 256, 256);
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(x, 0, 256, 256);

        renderer.renderFrame({
            camera,
            world: {
                map: bspData,
                surfaces: result.surfaces,
                textures: textureMap
            },
            timeSeconds: times[i],
            clearColor: [0.2, 0.2, 0.2, 1.0]
        }, []); // Pass empty entities array
      }
      gl.disable(gl.SCISSOR_TEST);
    `, {
      name: 'warp-water-animation',
      description: 'Water surface at t=0, t=1, t=2',
      width: 768, // 3 * 256
      height: 256,
      snapshotDir
    });
  });
