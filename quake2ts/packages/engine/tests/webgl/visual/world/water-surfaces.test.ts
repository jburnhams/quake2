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

test('warp: multiple warp surfaces - same texture', { timeout: 30000 }, async () => {
    // Task 1.3
    const bspMap = createTestBspMap({
      surfaces: [
        // Surface 1: Floor
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
        },
        // Surface 2: Ceiling (or another floor offset in space)
        {
          vertices: [
            [-64, 100, -64], // y=100
            [-64, 100,  64],
            [ 64, 100,  64],
            [ 64, 100, -64]
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
      camera.setPosition(200, 50, 0);
      camera.setRotation(0, 180, 0); // Look towards -X (where surfaces are)

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

      renderer.renderFrame({
        camera,
        world: {
          map: bspData,
          surfaces: result.surfaces,
          textures: textureMap
        },
        timeSeconds: 1.0,
        clearColor: [0.2, 0.2, 0.2, 1.0]
      }, []);
    `, {
      name: 'warp-multiple-surfaces',
      description: 'Multiple warp surfaces with same texture',
      width: 256,
      height: 256,
      snapshotDir
    });
});

test('warp: surfaces with different textures', { timeout: 30000 }, async () => {
    // Task 1.4
    const bspMap = createTestBspMap({
      surfaces: [
        // Surface 1: Water (left)
        {
          vertices: [
            [-64, 0, -64],
            [  0, 0, -64],
            [  0, 0,  64],
            [-64, 0,  64]
          ],
          texInfo: {
              texture: 'water',
              flags: SURF_WARP
          },
          styles: [0, 0, 0, 0]
        },
        // Surface 2: Slime (right)
        {
          vertices: [
            [  0, 0, -64],
            [ 64, 0, -64],
            [ 64, 0,  64],
            [  0, 0,  64]
          ],
          texInfo: {
              texture: 'slime',
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
      camera.setRotation(0, -90, 0); // Look down

      // Helper to create texture
      function createTex(r, g, b) {
          const size = 64;
          const pixels = new Uint8ClampedArray(size * size * 4);
          for(let i=0; i<size*size*4; i+=4) {
              pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = 255;
              const p = i/4;
              const x = p % size;
              const y = Math.floor(p / size);
              if (x%8===0 || y%8===0) { pixels[i]=255; pixels[i+1]=255; pixels[i+2]=255; }
          }
          const textureData = new ImageData(pixels, size, size);
          const t = new Texture2D(gl);
          t.upload(size, size, textureData);
          return t;
      }

      const waterTex = createTex(0, 50, 200);
      const slimeTex = createTex(50, 200, 0);

      const textureMap = new Map();
      textureMap.set('water', waterTex);
      textureMap.set('slime', slimeTex);

      const result = renderer.uploadBspGeometry(bspData);

      renderer.renderFrame({
        camera,
        world: {
          map: bspData,
          surfaces: result.surfaces,
          textures: textureMap
        },
        timeSeconds: 1.0,
        clearColor: [0.2, 0.2, 0.2, 1.0]
      }, []);
    `, {
      name: 'warp-different-textures',
      description: 'Warp surfaces with different textures (water and slime)',
      width: 256,
      height: 256,
      snapshotDir
    });
});

test('warp: no lightmaps on warp surfaces', { timeout: 30000 }, async () => {
    // Task 1.5
    // Create a surface with valid lightmap data but SURF_WARP flag.
    // The expectation is that the lightmap is ignored and only base texture is rendered (with warp).
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
          // Simulate having a lightmap (style 0 usually implies lightmap)
          // But `createTestBspMap` helper handles styles/lightmap allocation logic.
          // By passing a valid style, we signal lightmap usage if the flag wasn't SURF_WARP.
          styles: [0, 0, 0, 0]
        }
      ]
    });

    // Manually inject some fake lightmap data into bspMap to ensure it exists if referenced
    // (though createTestBspMap creates a small one by default)
    // We want to verify that even if lightmap data is present, it's not used.
    // This is hard to prove visually without a comparison or checking internals,
    // but we can at least verify it renders "normally" (like water) without crashing or looking like a lightmap.
    // Ideally we would set the lightmap to be pitch black or bright red to see if it affects the output.

    // Let's modify the lightmap data to be red, so if it WAS applied, the water would look red.
    // The `createTestBspMap` creates a default white lightmap.
    // We can overwrite it.
    const lmSize = 128 * 128 * 3; // Default size in helper
    bspMap.lightMaps = new Uint8Array(lmSize);
    for(let i=0; i<lmSize; i+=3) {
        bspMap.lightMaps[i] = 255;   // R
        bspMap.lightMaps[i+1] = 0;   // G
        bspMap.lightMaps[i+2] = 0;   // B
    }

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

      // Create standard blue water texture
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

      renderer.renderFrame({
        camera,
        world: {
          map: bspData,
          surfaces: result.surfaces,
          textures: textureMap
        },
        timeSeconds: 0.0,
        clearColor: [0.2, 0.2, 0.2, 1.0]
      }, []);
    `, {
      name: 'warp-no-lightmap',
      description: 'Warp surface ignoring red lightmap data',
      width: 256,
      height: 256,
      snapshotDir
    });
});
