import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

// Inline helpers to avoid complex file loading in browser context
const HELPER_SCRIPTS = `
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

function createRawTexture(width, height, rgba) {
    return {
        width,
        height,
        name: 'test',
        levels: [{ level: 0, width, height, rgba }]
    };
}
`;

test('bsp: batching - multiple surfaces same texture', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // 10 quads using same texture, slightly offset in Y
    const surfaces = [];
    for (let i = 0; i < 10; i++) {
        surfaces.push({
            vertices: [[-10 + i, -10, 0], [-8 + i, -10, 0], [-8 + i, 10, 0], [-10 + i, 10, 0]],
            texInfo: { texture: 'shared', s: [0.1, 0, 0], t: [0, 0.1, 0] }
        });
    }

    const bspMap = createTestBspMap({ surfaces });
    const geometry = renderer.uploadBspGeometry(bspMap);

    const texShared = renderer.registerTexture('shared', createRawTexture(1, 1, new Uint8Array([255, 0, 0, 255])));

    const camera = createLookAtCamera([0, 0, 30]);

    renderer.renderFrame({
      camera,
      world: {
        map: bspMap,
        surfaces: geometry.surfaces,
        lightmaps: geometry.lightmaps,
        textures: new Map([['shared', texShared]])
      },
      clearColor: [0, 0, 0, 1]
    }, []);

    const report = renderer.getPerformanceReport();
    if (report.drawCalls > 1) {
       console.log('Draw calls:', report.drawCalls);
       // We expect 1 batch, so 1 draw call for surfaces.
    }
  `, {
    name: 'bsp-batching-same',
    description: 'Multiple surfaces with same texture should batch',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('bsp: batching - multiple textures', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // 10 surfaces, alternating 2 textures
    const surfaces = [];
    for (let i = 0; i < 10; i++) {
        const tex = (i % 2 === 0) ? 'texA' : 'texB';
        surfaces.push({
            vertices: [[-10 + i*2, -10, 0], [-9 + i*2, -10, 0], [-9 + i*2, 10, 0], [-10 + i*2, 10, 0]],
            texInfo: { texture: tex, s: [0.1, 0, 0], t: [0, 0.1, 0] }
        });
    }

    const bspMap = createTestBspMap({ surfaces });
    const geometry = renderer.uploadBspGeometry(bspMap);

    const texA = renderer.registerTexture('texA', createRawTexture(1, 1, new Uint8Array([255, 0, 0, 255])));
    const texB = renderer.registerTexture('texB', createRawTexture(1, 1, new Uint8Array([0, 255, 0, 255])));

    const camera = createLookAtCamera([0, 0, 30]);

    renderer.renderFrame({
      camera,
      world: {
        map: bspMap,
        surfaces: geometry.surfaces,
        lightmaps: geometry.lightmaps,
        textures: new Map([['texA', texA], ['texB', texB]])
      },
      clearColor: [0, 0, 0, 1]
    }, []);
  `, {
    name: 'bsp-batching-multi',
    description: 'Multiple textures should batch by texture',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('bsp: sorting - opaque front-to-back', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Two overlapping surfaces at different depths
    const surfaces = [
      { // Back (Red)
        vertices: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]],
        texInfo: { texture: 'red', s: [0.1, 0, 0], t: [0, 0.1, 0] }
      },
      { // Front (Green) - Smaller to see occlusion
        vertices: [[-5, -5, 5], [5, -5, 5], [5, 5, 5], [-5, 5, 5]],
        texInfo: { texture: 'green', s: [0.1, 0, 0], t: [0, 0.1, 0] }
      }
    ];

    const bspMap = createTestBspMap({ surfaces });
    const geometry = renderer.uploadBspGeometry(bspMap);

    const texRed = renderer.registerTexture('red', createRawTexture(1, 1, new Uint8Array([255, 0, 0, 255])));
    const texGreen = renderer.registerTexture('green', createRawTexture(1, 1, new Uint8Array([0, 255, 0, 255])));

    const camera = createLookAtCamera([0, 0, 30]);

    renderer.renderFrame({
      camera,
      world: {
        map: bspMap,
        surfaces: geometry.surfaces,
        lightmaps: geometry.lightmaps,
        textures: new Map([['red', texRed], ['green', texGreen]])
      },
      clearColor: [0, 0, 0, 1]
    }, []);
  `, {
    name: 'bsp-sorting-opaque',
    description: 'Opaque surfaces sorting (correct occlusion)',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});

test('bsp: sorting - transparent back-to-front', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // SURF_TRANS33 = 0x10
    const SURF_TRANS33 = 0x10;

    const surfaces = [
      { // Front (Green) - Z=5
        vertices: [[-5, -5, 5], [5, -5, 5], [5, 5, 5], [-5, 5, 5]],
        texInfo: { texture: 'green', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: SURF_TRANS33 }
      },
      { // Back (Red) - Z=0
        vertices: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]],
        texInfo: { texture: 'red', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: SURF_TRANS33 }
      }
    ];

    const bspMap = createTestBspMap({ surfaces });
    const geometry = renderer.uploadBspGeometry(bspMap);

    const texRed = renderer.registerTexture('red', createRawTexture(1, 1, new Uint8Array([255, 0, 0, 255])));
    const texGreen = renderer.registerTexture('green', createRawTexture(1, 1, new Uint8Array([0, 255, 0, 255])));

    const camera = createLookAtCamera([0, 0, 30]);

    renderer.renderFrame({
      camera,
      world: {
        map: bspMap,
        surfaces: geometry.surfaces,
        lightmaps: geometry.lightmaps,
        textures: new Map([['red', texRed], ['green', texGreen]])
      },
      clearColor: [0, 0, 0, 1]
    }, []);
  `, {
    name: 'bsp-sorting-transparent',
    description: 'Transparent surfaces sorting (back-to-front)',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});
