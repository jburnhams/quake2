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

/**
 * Creates a collision plane with the specified normal and distance.
 * Automatically calculates the plane type and signbits.
 *
 * @param normal - The normal vector of the plane.
 * @param dist - The distance from the origin.
 * @returns A CollisionPlane object.
 */
export function makePlane(normal: SharedMath.Vec3, dist: number): CollisionPlane {
  return {
    normal,
    dist,
    type: Math.abs(normal.x) === 1 ? 0 : Math.abs(normal.y) === 1 ? 1 : Math.abs(normal.z) === 1 ? 2 : 3,
    signbits: computePlaneSignBits(normal),
  };
}

/**
 * Creates a simple axis-aligned cubic brush for testing.
 *
 * @param size - The size of the cube (width, height, depth).
 * @param contents - The content flags for the brush (default: CONTENTS_SOLID).
 * @returns A CollisionBrush object.
 */
export function makeAxisBrush(size: number, contents = CONTENTS_SOLID): CollisionBrush {
  const half = size / 2;
  const planes = [
    makePlane({ x: 1, y: 0, z: 0 }, half),
    makePlane({ x: -1, y: 0, z: 0 }, half),
    makePlane({ x: 0, y: 1, z: 0 }, half),
    makePlane({ x: 0, y: -1, z: 0 }, half),
    makePlane({ x: 0, y: 0, z: 1 }, half),
    makePlane({ x: 0, y: 0, z: -1 }, half),
  ];

  return {
    contents,
    sides: planes.map((plane) => ({ plane, surfaceFlags: 0 })),
  };
}

/**
 * Creates a BSP node.
 *
 * @param plane - The splitting plane for this node.
 * @param children - Indices of the children (positive for nodes, negative for leaves).
 * @returns A CollisionNode object.
 */
export function makeNode(plane: CollisionPlane, children: [number, number]): CollisionNode {
  return { plane, children };
}

/**
 * Constructs a full CollisionModel from components.
 *
 * @param planes - Array of planes.
 * @param nodes - Array of nodes.
 * @param leaves - Array of leaves.
 * @param brushes - Array of brushes.
 * @param leafBrushes - Array of leaf brush indices.
 * @returns A CollisionModel object.
 */
export function makeBspModel(
  planes: CollisionPlane[],
  nodes: CollisionNode[],
  leaves: CollisionLeaf[],
  brushes: CollisionBrush[],
  leafBrushes: number[]
): CollisionModel {
  return {
    planes,
    nodes,
    leaves,
    brushes,
    leafBrushes,
    bmodels: [],
  };
}

/**
 * Creates a BSP leaf.
 *
 * @param contents - The content flags for this leaf.
 * @param firstLeafBrush - Index into the leafBrushes array.
 * @param numLeafBrushes - Number of brushes in this leaf.
 * @returns A CollisionLeaf object.
 */
export function makeLeaf(contents: number, firstLeafBrush: number, numLeafBrushes: number): CollisionLeaf {
  return { contents, cluster: 0, area: 0, firstLeafBrush, numLeafBrushes };
}

/**
 * Creates a simplified CollisionModel consisting of a single leaf containing the provided brushes.
 * Useful for testing collision against a set of brushes without full BSP tree traversal.
 *
 * @param brushes - Array of CollisionBrushes to include.
 * @returns A CollisionModel object.
 */
export function makeLeafModel(brushes: CollisionBrush[]): CollisionModel {
  const planes = brushes.flatMap((brush) => brush.sides.map((side) => side.plane));

  return {
    planes,
    nodes: [],
    leaves: [makeLeaf(0, 0, brushes.length)],
    brushes,
    leafBrushes: brushes.map((_, i) => i),
    bmodels: [],
  };
}

/**
 * Creates a brush defined by min and max bounds.
 *
 * @param mins - Minimum coordinates (x, y, z).
 * @param maxs - Maximum coordinates (x, y, z).
 * @param contents - Content flags (default: CONTENTS_SOLID).
 * @returns A CollisionBrush object.
 */
export function makeBrushFromMinsMaxs(mins: SharedMath.Vec3, maxs: SharedMath.Vec3, contents = CONTENTS_SOLID): CollisionBrush {
  const planes = [
    makePlane({ x: 1, y: 0, z: 0 }, maxs.x),
    makePlane({ x: -1, y: 0, z: 0 }, -mins.x),
    makePlane({ x: 0, y: 1, z: 0 }, maxs.y),
    makePlane({ x: 0, y: -1, z: 0 }, -mins.y),
    makePlane({ x: 0, y: 0, z: 1 }, maxs.z),
    makePlane({ x: 0, y: 0, z: -1 }, -mins.z),
  ];

  return {
    contents,
    sides: planes.map((plane) => ({ plane, surfaceFlags: 0 })),
  };
}

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
      headNode: 0, firstFace: 0, numFaces: faces.length
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
