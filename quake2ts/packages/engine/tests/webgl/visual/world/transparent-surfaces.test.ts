import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

// Helper functions injected into the browser context
// Note: These are duplicated from bsp-geometry.test.ts for now to keep tests self-contained
const HELPER_SCRIPTS = `
function createTestBspMap(options = {}) {
  const vertices = [];
  const edges = [];
  const surfEdges = [];
  const faces = [];
  const texInfos = [];
  const lightMapInfo = [];

  // Aggregate lightmap data
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
      // Add vertices and create edges
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
      headNode: -1, // -1 means leaf 0 (-(0+1))
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
  // Use Float32Array for identity matrix to avoid glMatrix dependency
  const identity = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
  const camera = new Quake2Engine.Camera(identity);
  camera.setPosition(pos[0], pos[1], pos[2]);

  // To look at origin (0,0,0) from pos
  camera.lookAt([0,0,0]);

  camera.setFov(90);
  camera.setAspectRatio(1.0);
  return camera;
}

function createRawTexture(width, height, rgba) {
    return {
        width,
        height,
        name: 'test',
        levels: [{
            level: 0,
            width,
            height,
            rgba
        }]
    };
}
`;

test('bsp: transparency - 33% transparent surface', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Two quads: Opaque Blue behind (at Z=-10), Transparent Red in front (at Z=0)
    const surfaces = [
      // Background Opaque Quad (Blue)
      {
        vertices: [[-10, -10, -10], [10, -10, -10], [10, 10, -10], [-10, 10, -10]],
        texInfo: { texture: 'opaque_blue', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 0 }
      },
      // Foreground Transparent Quad (Red) - SURF_TRANS33 (1 << 4 = 16)
      {
        vertices: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]],
        texInfo: { texture: 'trans_red', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 16 }
      }
    ];

    const bspMap = createTestBspMap({ surfaces });
    const geometry = renderer.uploadBspGeometry(bspMap);

    renderer.registerTexture('opaque_blue', createRawTexture(1, 1, new Uint8Array([0, 0, 255, 255])));
    renderer.registerTexture('trans_red', createRawTexture(1, 1, new Uint8Array([255, 0, 0, 255])));

    const camera = createLookAtCamera([0, 0, 30]);

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
    name: 'bsp-trans33',
    description: '33% transparent red surface over opaque blue',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('bsp: transparency - 66% transparent surface', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Two quads: Opaque Blue behind (at Z=-10), Transparent Red in front (at Z=0)
    const surfaces = [
      // Background Opaque Quad (Blue)
      {
        vertices: [[-10, -10, -10], [10, -10, -10], [10, 10, -10], [-10, 10, -10]],
        texInfo: { texture: 'opaque_blue', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 0 }
      },
      // Foreground Transparent Quad (Red) - SURF_TRANS66 (1 << 5 = 32)
      {
        vertices: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]],
        texInfo: { texture: 'trans_red', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 32 }
      }
    ];

    const bspMap = createTestBspMap({ surfaces });
    const geometry = renderer.uploadBspGeometry(bspMap);

    renderer.registerTexture('opaque_blue', createRawTexture(1, 1, new Uint8Array([0, 0, 255, 255])));
    renderer.registerTexture('trans_red', createRawTexture(1, 1, new Uint8Array([255, 0, 0, 255])));

    const camera = createLookAtCamera([0, 0, 30]);

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
    name: 'bsp-trans66',
    description: '66% transparent red surface over opaque blue',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('bsp: transparency - mixed levels', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Three quads:
    // 1. Opaque Blue (Back, Z=-10)
    // 2. Trans33 Red (Middle, Z=0) - SURF_TRANS33 (16)
    // 3. Trans66 Green (Front, Z=10) - SURF_TRANS66 (32)
    const surfaces = [
      {
        vertices: [[-10, -10, -10], [10, -10, -10], [10, 10, -10], [-10, 10, -10]],
        texInfo: { texture: 'opaque_blue', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 0 }
      },
      {
        vertices: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]],
        texInfo: { texture: 'trans_red', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 16 }
      },
      {
        vertices: [[-2, -2, 10], [2, -2, 10], [2, 2, 10], [-2, 2, 10]],
        texInfo: { texture: 'trans_green', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 32 }
      }
    ];

    const bspMap = createTestBspMap({ surfaces });
    const geometry = renderer.uploadBspGeometry(bspMap);

    renderer.registerTexture('opaque_blue', createRawTexture(1, 1, new Uint8Array([0, 0, 255, 255])));
    renderer.registerTexture('trans_red', createRawTexture(1, 1, new Uint8Array([255, 0, 0, 255])));
    renderer.registerTexture('trans_green', createRawTexture(1, 1, new Uint8Array([0, 255, 0, 255])));

    const camera = createLookAtCamera([0, 0, 50]);

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
    name: 'bsp-trans-mixed',
    description: 'Mixed transparency levels (33% and 66%) overlapping opaque',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('bsp: transparency - back-to-front sorting', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Three semi-transparent surfaces at different depths
    // If sorted correctly, we should see the blending of all three in correct order
    const surfaces = [
      // Back (Red) at Z=-10
      {
        vertices: [[-10, -10, -10], [10, -10, -10], [10, 10, -10], [-10, 10, -10]],
        texInfo: { texture: 'red_trans', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 16 } // 33% trans
      },
      // Middle (Green) at Z=0
      {
        vertices: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]],
        texInfo: { texture: 'green_trans', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 32 } // 66% trans
      },
      // Front (Blue) at Z=10
      {
        vertices: [[-2, -2, 10], [2, -2, 10], [2, 2, 10], [-2, 2, 10]],
        texInfo: { texture: 'blue_trans', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 16 } // 33% trans
      }
    ];

    const bspMap = createTestBspMap({ surfaces });
    const geometry = renderer.uploadBspGeometry(bspMap);

    renderer.registerTexture('red_trans', createRawTexture(1, 1, new Uint8Array([255, 0, 0, 255])));
    renderer.registerTexture('green_trans', createRawTexture(1, 1, new Uint8Array([0, 255, 0, 255])));
    renderer.registerTexture('blue_trans', createRawTexture(1, 1, new Uint8Array([0, 0, 255, 255])));

    const camera = createLookAtCamera([0, 0, 50]);

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
    name: 'bsp-trans-sorting',
    description: 'Back-to-front sorting of transparent surfaces',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('bsp: transparency - overlapping surfaces', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Two intersecting transparent planes forming an X
    const surfaces = [
      // Plane 1: / diagonal
      {
        vertices: [[-10, -10, 0], [10, 10, 0], [10, 10, 10], [-10, -10, 10]],
        texInfo: { texture: 'red_trans', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 16 }
      },
      // Plane 2: \\ diagonal
      {
        vertices: [[-10, 10, 0], [10, -10, 0], [10, -10, 10], [-10, 10, 10]],
        texInfo: { texture: 'blue_trans', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 16 }
      }
    ];

    const bspMap = createTestBspMap({ surfaces });
    const geometry = renderer.uploadBspGeometry(bspMap);

    renderer.registerTexture('red_trans', createRawTexture(1, 1, new Uint8Array([255, 0, 0, 255])));
    renderer.registerTexture('blue_trans', createRawTexture(1, 1, new Uint8Array([0, 0, 255, 255])));

    const camera = createLookAtCamera([0, 20, 5]); // Look from side/top

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
    name: 'bsp-trans-overlap',
    description: 'Intersecting transparent surfaces',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('bsp: transparency - transparent over opaque', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Opaque wall with a transparent "window" in front
    const surfaces = [
      // Opaque Wall (Checkerboard)
      {
        vertices: [[-10, -10, -5], [10, -10, -5], [10, 10, -5], [-10, 10, -5]],
        texInfo: { texture: 'checker', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 0 }
      },
      // Transparent Window (Cyan 33%)
      {
        vertices: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]],
        texInfo: { texture: 'window', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 16 }
      }
    ];

    const bspMap = createTestBspMap({ surfaces });
    const geometry = renderer.uploadBspGeometry(bspMap);

    const checkTex = new Uint8Array([
      255, 255, 255, 255,  0, 0, 0, 255,
      0, 0, 0, 255,        255, 255, 255, 255
    ]);
    renderer.registerTexture('checker', createRawTexture(2, 2, checkTex));
    renderer.registerTexture('window', createRawTexture(1, 1, new Uint8Array([0, 255, 255, 255])));

    const camera = createLookAtCamera([0, 0, 20]);

    renderer.renderFrame({
      camera,
      world: {
        map: bspMap,
        surfaces: geometry.surfaces,
        lightmaps: geometry.lightmaps,
        textures: renderer.getTextures ? renderer.getTextures() : undefined
      },
      clearColor: [0.2, 0.2, 0.2, 1]
    }, []);
  `, {
    name: 'bsp-trans-opaque-comp',
    description: 'Transparent surface over textured opaque surface',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('bsp: transparency - z-fighting test', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Two surfaces at nearly identical depth
    // 1. Opaque Green at Z=0
    // 2. Transparent Red at Z=0.01 (very close)
    const surfaces = [
      {
        vertices: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]],
        texInfo: { texture: 'opaque_green', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 0 }
      },
      {
        vertices: [[-5, -5, 0.01], [5, -5, 0.01], [5, 5, 0.01], [-5, 5, 0.01]],
        texInfo: { texture: 'trans_red', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 16 }
      }
    ];

    const bspMap = createTestBspMap({ surfaces });
    const geometry = renderer.uploadBspGeometry(bspMap);

    renderer.registerTexture('opaque_green', createRawTexture(1, 1, new Uint8Array([0, 255, 0, 255])));
    renderer.registerTexture('trans_red', createRawTexture(1, 1, new Uint8Array([255, 0, 0, 255])));

    const camera = createLookAtCamera([0, 0, 30]);

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
    name: 'bsp-trans-zfight',
    description: 'Co-planar surfaces test (opaque vs transparent)',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});
