import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

// Helper functions injected into the browser context
const HELPER_SCRIPTS = `
// Minimal BspMap creation for testing
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

test('bsp: single textured quad', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Single quad on XY plane
    const surface = {
      vertices: [
        [-10, -10, 0],
        [10, -10, 0],
        [10, 10, 0],
        [-10, 10, 0]
      ],
      texInfo: {
        texture: 'test_brick',
        s: [0.1, 0, 0], sOffset: 0,
        t: [0, 0.1, 0], tOffset: 0,
        flags: 0,
      }
    };

    const bspMap = createTestBspMap({ surfaces: [surface] });
    const geometry = renderer.uploadBspGeometry(bspMap);

    // Mock texture
    renderer.registerTexture('test_brick', createRawTexture(1, 1, new Uint8Array([200, 50, 50, 255])));

    const camera = createLookAtCamera([0, 0, 25]);

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
    name: 'bsp-single-quad',
    description: 'Single textured quad from BSP geometry',
    width: 256,
    height: 256,
    snapshotDir
  });
});

test('bsp: multiple surfaces - different textures', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Three quads with different textures
    const surfaces = [
      { // Left
        vertices: [[-15, -5, 0], [-5, -5, 0], [-5, 5, 0], [-15, 5, 0]],
        texInfo: { texture: 'tex_red', s: [0.1, 0, 0], t: [0, 0.1, 0] }
      },
      { // Center
        vertices: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]],
        texInfo: { texture: 'tex_green', s: [0.1, 0, 0], t: [0, 0.1, 0] }
      },
      { // Right
        vertices: [[5, -5, 0], [15, -5, 0], [15, 5, 0], [5, 5, 0]],
        texInfo: { texture: 'tex_blue', s: [0.1, 0, 0], t: [0, 0.1, 0] }
      }
    ];

    const bspMap = createTestBspMap({ surfaces });
    const geometry = renderer.uploadBspGeometry(bspMap);

    renderer.registerTexture('tex_red', createRawTexture(1, 1, new Uint8Array([255, 0, 0, 255])));
    renderer.registerTexture('tex_green', createRawTexture(1, 1, new Uint8Array([0, 255, 0, 255])));
    renderer.registerTexture('tex_blue', createRawTexture(1, 1, new Uint8Array([0, 0, 255, 255])));

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
    name: 'bsp-multi-texture',
    description: 'Multiple surfaces with different textures',
    width: 256,
    height: 256,
    snapshotDir
  });
});

test('bsp: textured cube - 6 faces', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // Define 6 faces of a cube size 10 centered at origin
    // Using Quake coordinate system: X=forward, Y=left, Z=up
    const s = 10;
    const surfaces = [
      // Front (X+) - visible from +X (forward)
      { vertices: [[s, -s, -s], [s, s, -s], [s, s, s], [s, -s, s]], texInfo: { texture: 'front', s: [0, 0.05, 0], t: [0, 0, 0.05] } },
      // Back (X-) - visible from -X (backward)
      { vertices: [[-s, s, -s], [-s, -s, -s], [-s, -s, s], [-s, s, s]], texInfo: { texture: 'back', s: [0, 0.05, 0], t: [0, 0, 0.05] } },
      // Left (Y+) - visible from +Y (left side)
      { vertices: [[-s, s, -s], [-s, s, s], [s, s, s], [s, s, -s]], texInfo: { texture: 'left', s: [0.05, 0, 0], t: [0, 0, 0.05] } },
      // Right (Y-) - visible from -Y (right side)
      { vertices: [[s, -s, -s], [s, -s, s], [-s, -s, s], [-s, -s, -s]], texInfo: { texture: 'right', s: [0.05, 0, 0], t: [0, 0, 0.05] } },
      // Top (Z+) - visible from +Z (above)
      { vertices: [[-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s]], texInfo: { texture: 'top', s: [0.05, 0, 0], t: [0, 0.05, 0] } },
      // Bottom (Z-) - visible from -Z (below)
      { vertices: [[-s, s, -s], [s, s, -s], [s, -s, -s], [-s, -s, -s]], texInfo: { texture: 'bottom', s: [0.05, 0, 0], t: [0, 0.05, 0] } },
    ];

    const bspMap = createTestBspMap({ surfaces });
    const geometry = renderer.uploadBspGeometry(bspMap);

    // Front=Red (X+), Back=Cyan (X-), Left=Magenta (Y+), Right=Green (Y-), Top=Blue (Z+), Bottom=Yellow (Z-)
    const texFront = renderer.registerTexture('front', createRawTexture(1, 1, new Uint8Array([255, 0, 0, 255])));
    const texBack = renderer.registerTexture('back', createRawTexture(1, 1, new Uint8Array([0, 255, 255, 255]))); // Cyan
    const texLeft = renderer.registerTexture('left', createRawTexture(1, 1, new Uint8Array([255, 0, 255, 255]))); // Magenta
    const texRight = renderer.registerTexture('right', createRawTexture(1, 1, new Uint8Array([0, 255, 0, 255])));
    const texTop = renderer.registerTexture('top', createRawTexture(1, 1, new Uint8Array([0, 0, 255, 255])));
    const texBottom = renderer.registerTexture('bottom', createRawTexture(1, 1, new Uint8Array([255, 255, 0, 255]))); // Yellow

    const textureMap = new Map([
      ['front', texFront],
      ['back', texBack],
      ['left', texLeft],
      ['right', texRight],
      ['top', texTop],
      ['bottom', texBottom]
    ]);

    // View from a corner showing back (cyan), right (green), and top (blue) faces
    // Camera at [-30, -15, 30] (behind, to the right, above)
    const camera = createLookAtCamera([-30, -15, 30]);

    renderer.renderFrame({
      camera,
      world: {
        map: bspMap,
        surfaces: geometry.surfaces,
        lightmaps: geometry.lightmaps,
        textures: textureMap
      },
      clearColor: [0.1, 0.1, 0.1, 1]
    }, []);
  `, {
    name: 'bsp-cube-corner',
    description: 'Textured cube viewed from corner',
    width: 256,
    height: 256,
    snapshotDir
  });
});

test('bsp: surface with scrolling texture', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    ${HELPER_SCRIPTS}

    // One large quad with scrolling texture
    const surface = {
      vertices: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]],
      // Add SURF_FLOWING (1 << 6 = 64) flag to enable scrolling
      texInfo: { texture: 'scroll_tex', s: [0.1, 0, 0], t: [0, 0.1, 0], flags: 64 }
    };

    const bspMap = createTestBspMap({ surfaces: [surface] });
    const geometry = renderer.uploadBspGeometry(bspMap);

    // Create a 2x2 checkerboard texture to make scrolling obvious
    // 2x2 pixels = 4 pixels * 4 bytes = 16 bytes
    // Red, Black
    // Black, Red
    const texData = new Uint8Array([
      255, 0, 0, 255,   0, 0, 0, 255,
      0, 0, 0, 255,     255, 0, 0, 255
    ]);
    renderer.registerTexture('scroll_tex', createRawTexture(2, 2, texData));

    const camera = createLookAtCamera([0, 0, 30]);

    // Render multiple frames to show animation/scrolling
    // t=0: Initial state
    renderer.renderFrame({
      camera,
      world: {
        map: bspMap,
        surfaces: geometry.surfaces,
        lightmaps: geometry.lightmaps,
        textures: renderer.getTextures ? renderer.getTextures() : undefined
      },
      timeSeconds: 0,
      clearColor: [0, 0, 0, 1]
    }, []);

    // t=1: Scrolled state (timeSeconds changes flow offset)
    // The shader uses (time * 0.25) % 1 for scrolling
    // t=1.0 means 0.25 shift
    renderer.renderFrame({
      camera,
      world: {
        map: bspMap,
        surfaces: geometry.surfaces,
        lightmaps: geometry.lightmaps,
        textures: renderer.getTextures ? renderer.getTextures() : undefined
      },
      timeSeconds: 1.0,
      clearColor: [0, 0, 0, 1]
    }, []);
  `, {
    name: 'bsp-scroll-animated',
    description: 'Scrolling textured surface (SURF_FLOWING)',
    width: 256,
    height: 256,
    snapshotDir
  });
});
