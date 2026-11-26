import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

const HELPER_SCRIPTS = `
// Re-using helper scripts from bsp-geometry.test.ts (inlined for now)
function createTestBspMap(options = {}) {
  const vertices = [];
  const edges = [];
  const surfEdges = [];
  const faces = [];
  const texInfos = [];
  const lightMapInfo = [];

  let lightMapDataSize = 0;
  if (options.surfaces) {
    for (const surface of options.surfaces) {
        if (surface.lightmap) {
            lightMapDataSize += surface.lightmap.length;
        }
    }
  }
  const lightMaps = new Uint8Array(lightMapDataSize);
  let currentLightMapOffset = 0;

  if (options.surfaces) {
    for (const surface of options.surfaces) {
      const firstEdge = surfEdges.length;
      const startVertexIndex = vertices.length;

      for (const v of surface.vertices) {
        vertices.push(v);
      }

      for (let i = 0; i < surface.vertices.length; i++) {
        const v1 = startVertexIndex + i;
        const v2 = startVertexIndex + ((i + 1) % surface.vertices.length);
        edges.push({ vertices: [v1, v2] });
        surfEdges.push(edges.length - 1);
      }

      const defaultTexInfo = {
        s: [1, 0, 0], sOffset: 0,
        t: [0, 1, 0], tOffset: 0,
        flags: 0, value: 0,
        texture: 'test_texture',
        nextTexInfo: -1
      };
      const texInfo = { ...defaultTexInfo, ...surface.texInfo };
      texInfos.push(texInfo);

      let lightOffset = -1;
      let info = undefined;

      if (surface.lightmap) {
        lightOffset = currentLightMapOffset;
        lightMaps.set(surface.lightmap, lightOffset);
        info = { offset: lightOffset, length: surface.lightmap.length };
        currentLightMapOffset += surface.lightmap.length;
      }
      lightMapInfo.push(info);

      faces.push({
        planeIndex: 0,
        side: 0,
        firstEdge,
        numEdges: surface.vertices.length,
        texInfo: texInfos.length - 1,
        styles: surface.styles ?? [255, 255, 255, 255],
        lightOffset
      });
    }
  }

  const header = { version: 38, lumps: new Map() };
  const entities = {
    raw: '',
    entities: options.entities || [],
    worldspawn: undefined,
    getUniqueClassnames: () => []
  };

  const planes = [{ normal: [0, 0, 1], dist: 0, type: 0 }];
  const nodes = [];
  const leafs = [{
      contents: 0, cluster: 0, area: 0,
      mins: [-1000, -1000, -1000], maxs: [1000, 1000, 1000],
      firstLeafFace: 0, numLeafFaces: faces.length,
      firstLeafBrush: 0, numLeafBrushes: 0
  }];
  const leafLists = {
      leafFaces: [faces.map((_, i) => i)],
      leafBrushes: [[]]
  };

  const models = [{
      mins: [-1000, -1000, -1000], maxs: [1000, 1000, 1000], origin: [0,0,0],
      headNode: -1,
      firstFace: 0, numFaces: faces.length
  }];

  const data = {
    header, entities, planes, vertices, nodes, texInfo: texInfos, faces,
    lightMaps, lightMapInfo, leafs, leafLists, edges, surfEdges: Int32Array.from(surfEdges),
    models, brushes: [], brushSides: [], visibility: undefined, areas: [], areaPortals: []
  };

  return {
    ...data,
    pickEntity: () => null,
    findLeaf: () => leafs[0],
    calculatePVS: () => undefined
  };
}

function createLookAtCamera(pos) {
  const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const camera = new Quake2Engine.Camera(identity);
  camera.setPosition(pos[0], pos[1], pos[2]);
  camera.lookAt([0,0,0]);
  camera.setFov(90);
  camera.setAspectRatio(1.0);
  return camera;
}

function createRawTexture(width, height, rgba, name = 'test') {
    return {
        width,
        height,
        name: name,
        levels: [{ level: 0, width, height, rgba }]
    };
}

function createTestLightmap(width, height, r, g, b) {
    const size = width * height * 3;
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i+=3) {
        data[i] = r;
        data[i+1] = g;
        data[i+2] = b;
    }
    return data;
}
`;

test('lightmap: single surface with static lightmap', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Quad with a red lightmap
    // Using smaller quad size (10x10) to match working tests
    // Texture coords range from -8 to 8, so lightmap is ceil(8/16) - floor(-8/16) + 1 = 1 - (-1) + 1 = 3
    const lm = createTestLightmap(3, 3, 255, 0, 0); // Red
    const surface = {
      vertices: [[-8, -8, 0], [8, -8, 0], [8, 8, 0], [-8, 8, 0]],
      texInfo: { texture: 'base', s: [1, 0, 0], t: [0, 1, 0] },
      lightmap: lm,
      styles: [0, 255, 255, 255] // Style 0 only
    };

    const bspMap = createTestBspMap({ surfaces: [surface] });
    const geometry = renderer.uploadBspGeometry(bspMap);

    // White base texture so lightmap color shows clearly
    renderer.registerTexture('base', createRawTexture(1, 1, new Uint8Array([255, 255, 255, 255]), 'base'));

    const camera = createLookAtCamera([0, 0, 25]);

    renderer.setFullbright(false);

    renderer.renderFrame({
      camera,
      world: {
        map: bspMap,
        surfaces: geometry.surfaces,
        lightmaps: geometry.lightmaps,
        textures: renderer.getTextures ? renderer.getTextures() : undefined
      },
      clearColor: [0, 0, 0, 1]
    }, []);
  `, {
    name: 'lightmap-static-red',
    description: 'Surface with static red lightmap. Should be RED.',
    width: 256,
    height: 256,
    snapshotDir
  });
});

test('lightmap: surface with base texture + lightmap', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Quad with white base texture + green lightmap
    // Should result in green surface
    const lm = createTestLightmap(3, 3, 0, 255, 0); // Green
    const surface = {
      vertices: [[-8, -8, 0], [8, -8, 0], [8, 8, 0], [-8, 8, 0]],
      texInfo: { texture: 'checker', s: [1, 0, 0], t: [0, 1, 0] },
      lightmap: lm,
      styles: [0, 255, 255, 255]
    };

    const bspMap = createTestBspMap({ surfaces: [surface] });
    const geometry = renderer.uploadBspGeometry(bspMap);

    // Checkerboard texture (white and grey)
    const checker = new Uint8Array([
        255, 255, 255, 255,  128, 128, 128, 255,
        128, 128, 128, 255,  255, 255, 255, 255
    ]);
    renderer.registerTexture('checker', createRawTexture(2, 2, checker, 'checker'));

    const camera = createLookAtCamera([0, 0, 25]);

    renderer.setFullbright(false);

    renderer.renderFrame({
      camera,
      world: {
        map: bspMap,
        surfaces: geometry.surfaces,
        lightmaps: geometry.lightmaps,
        textures: renderer.getTextures ? renderer.getTextures() : undefined
      },
      clearColor: [0, 0, 0, 1]
    }, []);
  `, {
    name: 'lightmap-blend',
    description: 'Base texture (Checker) blended with lightmap (Green). Should be GREEN CHECKERBOARD.',
    width: 256,
    height: 256,
    snapshotDir
  });
});

test('lightmap: fullbright mode', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Quad with dark lightmap (blue), but rendered in fullbright
    const lm = createTestLightmap(3, 3, 0, 0, 50); // Dark Blue
    const surface = {
      vertices: [[-8, -8, 0], [8, -8, 0], [8, 8, 0], [-8, 8, 0]],
      texInfo: { texture: 'base', s: [1, 0, 0], t: [0, 1, 0] },
      lightmap: lm,
      styles: [0, 255, 255, 255]
    };

    const bspMap = createTestBspMap({ surfaces: [surface] });
    const geometry = renderer.uploadBspGeometry(bspMap);

    renderer.registerTexture('base', createRawTexture(1, 1, new Uint8Array([255, 255, 255, 255]), 'base'));

    const camera = createLookAtCamera([0, 0, 25]);

    // Enable fullbright
    renderer.setFullbright(true);

    renderer.renderFrame({
      camera,
      world: {
        map: bspMap,
        surfaces: geometry.surfaces,
        lightmaps: geometry.lightmaps,
        textures: renderer.getTextures ? renderer.getTextures() : undefined
      },
      clearColor: [0, 0, 0, 1]
    }, []);
  `, {
    name: 'lightmap-fullbright',
    description: 'Lightmaps ignored in fullbright mode. Should be WHITE (base texture only).',
    width: 256,
    height: 256,
    snapshotDir
  });
});

test('lightmap: light styles', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Quad with multiple light styles
    const width = 3;
    const height = 3;
    const data = new Uint8Array(width * height * 3 * 3);

    // Style 0 (Red)
    let offset = 0;
    for (let i = 0; i < width * height; i++) {
        data[offset++] = 255;
        data[offset++] = 0;
        data[offset++] = 0;
    }
    // Style 1 (Blue)
    for (let i = 0; i < width * height; i++) {
        data[offset++] = 0;
        data[offset++] = 0;
        data[offset++] = 255;
    }
    // Style 2 (Green)
    for (let i = 0; i < width * height; i++) {
        data[offset++] = 0;
        data[offset++] = 255;
        data[offset++] = 0;
    }

    const surface = {
      vertices: [[-8, -8, 0], [8, -8, 0], [8, 8, 0], [-8, 8, 0]],
      texInfo: { texture: 'base', s: [1, 0, 0], t: [0, 1, 0] },
      lightmap: data,
      styles: [0, 1, 2, 255] // Uses styles 0, 1, and 2
    };

    const bspMap = createTestBspMap({ surfaces: [surface] });
    const geometry = renderer.uploadBspGeometry(bspMap);

    renderer.registerTexture('base', createRawTexture(1, 1, new Uint8Array([255, 255, 255, 255]), 'base'));

    const camera = createLookAtCamera([0, 0, 25]);

    renderer.setFullbright(false);

    renderer.setLightStyle(0, 'm'); // On
    renderer.setLightStyle(1, 'm'); // On
    renderer.setLightStyle(2, 'a'); // Off

    // Expected: Red + Blue = Purple/Magenta. Green off.

    renderer.renderFrame({
      camera,
      world: {
        map: bspMap,
        surfaces: geometry.surfaces,
        lightmaps: geometry.lightmaps,
        textures: renderer.getTextures ? renderer.getTextures() : undefined
      },
      clearColor: [0, 0, 0, 1]
    }, []);
  `, {
    name: 'lightmap-styles',
    description: 'Multi-style lightmap blending. Red + Blue = MAGENTA.',
    width: 256,
    height: 256,
    snapshotDir
  });
});
