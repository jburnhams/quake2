import {
  computePlaneSignBits,
  type CollisionBrush,
  type CollisionModel,
  type CollisionPlane,
  type CollisionNode,
  type CollisionLeaf,
  CONTENTS_SOLID
} from '@quake2ts/shared';
// Avoid named imports for Vec3 from shared to avoid conflict with engine tuple type
import * as SharedMath from '@quake2ts/shared';

import {
  type BspMap,
  type BspFace,
  type BspTexInfo,
  type BspNode,
  type BspLeaf,
  type BspModel,
  type BspEdge,
  type BspEntity,
  type BspHeader,
  type BspEntities,
  type BspPlane,
  type BspLightmapInfo,
  type BspLeafLists,
  type BspData
} from '@quake2ts/engine';

export {
  makePlane,
  makeAxisBrush,
  makeNode,
  makeBspModel,
  makeLeaf,
  makeLeafModel,
  makeBrushFromMinsMaxs
} from '@quake2ts/shared/testing';

// --- Visual Test Helpers ---

// BspVec3 matches the tuple type used in engine assets
export type BspVec3 = [number, number, number];

export interface TestBspSurface {
  vertices: BspVec3[];
  texInfo?: Partial<BspTexInfo>;
  lightmap?: Uint8Array;
  lightmapInfo?: BspLightmapInfo;
  styles?: [number, number, number, number];
}

export interface TestBspMapOptions {
  surfaces?: TestBspSurface[];
  entities?: BspEntity[];
}

/**
 * Creates a minimal valid BspMap for testing rendering.
 *
 * @param options - Configuration for the test BSP map.
 * @returns A BspMap object populated with the requested surfaces.
 */
export function createTestBspMap(options: TestBspMapOptions = {}): BspMap {
  const vertices: BspVec3[] = [];
  const edges: BspEdge[] = [];
  const surfEdges: number[] = []; // Using number[] to match push usage, converted to Int32Array later
  const faces: BspFace[] = [];
  const texInfos: BspTexInfo[] = [];
  const lightMapInfo: (BspLightmapInfo | undefined)[] = [];

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
        surfEdges.push(edges.length - 1); // Positive index for standard winding
      }

      // Add TexInfo
      const defaultTexInfo: BspTexInfo = {
        s: [1, 0, 0], sOffset: 0,
        t: [0, 1, 0], tOffset: 0,
        flags: 0, value: 0,
        texture: 'test_texture',
        nextTexInfo: -1
      };
      const texInfo: BspTexInfo = { ...defaultTexInfo, ...surface.texInfo };
      texInfos.push(texInfo);

      // Handle Lightmap
      let lightOffset = -1;
      let info: BspLightmapInfo | undefined = undefined;

      if (surface.lightmap) {
        lightOffset = currentLightMapOffset;
        lightMaps.set(surface.lightmap, lightOffset);
        info = { offset: lightOffset, length: surface.lightmap.length };
        currentLightMapOffset += surface.lightmap.length;
      }
      lightMapInfo.push(info);

      faces.push({
        planeIndex: 0, // Dummy plane
        side: 0,
        firstEdge,
        numEdges: surface.vertices.length,
        texInfo: texInfos.length - 1,
        styles: surface.styles ?? [255, 255, 255, 255], // Default styles
        lightOffset
      });
    }
  }

  // Minimal valid BSP structure
  const header: BspHeader = { version: 38, lumps: new Map() };
  const entities: BspEntities = {
    raw: '',
    entities: options.entities || [],
    worldspawn: undefined,
    getUniqueClassnames: () => []
  };

  const planes: BspPlane[] = [{ normal: [0, 0, 1], dist: 0, type: 0 }]; // Dummy plane
  const nodes: BspNode[] = [];
  const leafs: BspLeaf[] = [{
      contents: 0, cluster: 0, area: 0,
      mins: [-1000, -1000, -1000], maxs: [1000, 1000, 1000],
      firstLeafFace: 0, numLeafFaces: faces.length,
      firstLeafBrush: 0, numLeafBrushes: 0
  }];
  const leafLists: BspLeafLists = {
      leafFaces: [faces.map((_, i) => i)],
      leafBrushes: [[]]
  };

  const models: BspModel[] = [{
      mins: [-1000, -1000, -1000], maxs: [1000, 1000, 1000], origin: [0,0,0],
      headNode: -1, // -1 points to Leaf 0 (implied, assuming simple map)
      firstFace: 0, numFaces: faces.length
  }];

  const data: BspData = {
    header, entities, planes, vertices, nodes, texInfo: texInfos, faces,
    lightMaps, lightMapInfo, leafs, leafLists, edges, surfEdges: Int32Array.from(surfEdges),
    models, brushes: [], brushSides: [], visibility: undefined, areas: [], areaPortals: []
  };

  // Create the BspMap with methods
  return {
    ...data,
    pickEntity: () => null,
    findLeaf: () => leafs[0],
    calculatePVS: () => undefined
  };
}

/**
 * Creates a simple solid color lightmap of specified dimensions.
 *
 * @param width - Width of the lightmap (usually small, e.g. 16x16)
 * @param height - Height of the lightmap
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Uint8Array containing RGB data
 */
export function createTestLightmap(width: number, height: number, r: number, g: number, b: number): Uint8Array {
    const size = width * height * 3;
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i+=3) {
        data[i] = r;
        data[i+1] = g;
        data[i+2] = b;
    }
    return data;
}
