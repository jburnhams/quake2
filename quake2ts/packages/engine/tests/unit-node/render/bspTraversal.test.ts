import { describe, expect, it } from 'vitest';
import { boxIntersectsFrustum, extractFrustumPlanes } from '../../../src/render/culling.js';
import { findLeafForPoint, gatherVisibleFaces } from '../../../src/render/bspTraversal.js';
import type { BspMap } from '../../../src/assets/bsp.js';

function makeTestMap(): BspMap {
  const planes = [
    { normal: [1, 0, 0] as [number, number, number], dist: 0, type: 0 },
  ];

  const nodes = [
    {
      planeIndex: 0,
      children: [-2, -1],
      mins: [-12, -12, -12] as [number, number, number],
      maxs: [12, 12, 12] as [number, number, number],
      firstFace: 0,
      numFaces: 0,
    },
  ];

  const faces = [
    { planeIndex: 0, side: 0, firstEdge: 0, numEdges: 0, texInfo: 0, styles: [0, 255, 255, 255], lightOffset: -1 },
    { planeIndex: 0, side: 1, firstEdge: 0, numEdges: 0, texInfo: 0, styles: [0, 255, 255, 255], lightOffset: -1 },
  ];

  const leafs = [
    {
      contents: 0,
      cluster: 0,
      area: 0,
      mins: [-12, -12, -12] as [number, number, number],
      maxs: [-1, 12, 12] as [number, number, number],
      firstLeafFace: 0,
      numLeafFaces: 1,
      firstLeafBrush: 0,
      numLeafBrushes: 0,
    },
    {
      contents: 0,
      cluster: 1,
      area: 0,
      mins: [1, -12, -12] as [number, number, number],
      maxs: [12, 12, 12] as [number, number, number],
      firstLeafFace: 1,
      numLeafFaces: 1,
      firstLeafBrush: 0,
      numLeafBrushes: 0,
    },
  ];

  const pvsRow0 = new Uint8Array([0b00000001]); // cluster 0 only sees itself
  const pvsRow1 = new Uint8Array([0b00000011]); // cluster 1 sees both clusters

  return {
    header: { version: 38, lumps: new Map() },
    entities: { raw: '', entities: [], worldspawn: undefined },
    planes,
    vertices: [],
    nodes,
    texInfo: [],
    faces,
    lightMaps: new Uint8Array(),
    lightMapInfo: [],
    leafs,
    leafLists: { leafFaces: [[0], [1]], leafBrushes: [[], []] },
    edges: [],
    surfEdges: new Int32Array(),
    models: [
      {
        mins: [-12, -12, -12] as [number, number, number],
        maxs: [12, 12, 12] as [number, number, number],
        origin: [0, 0, 0] as [number, number, number],
        headNode: 0,
        firstFace: 0,
        numFaces: 0,
      },
    ],
    brushes: [],
    brushSides: [],
    visibility: { numClusters: 2, clusters: [{ pvs: pvsRow0, phs: pvsRow0 }, { pvs: pvsRow1, phs: pvsRow1 }] },
  };
}

const identityFrustum = extractFrustumPlanes([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

describe('culling helpers', () => {
  it('extracts normalized frustum planes from a column-major matrix', () => {
    expect(identityFrustum).toHaveLength(6);
    const left = identityFrustum[0];
    expect(left.normal).toEqual({ x: 1, y: 0, z: 0 });
    expect(left.distance).toBeCloseTo(1);
    const far = identityFrustum[5];
    expect(far.normal.z).toBeCloseTo(-1);
    expect(far.distance).toBeCloseTo(1);
  });

  it('culls boxes that sit completely outside any frustum plane', () => {
    const inside = boxIntersectsFrustum({ x: 0, y: 0, z: 0 }, { x: 0.5, y: 0.5, z: 0.5 }, identityFrustum);
    expect(inside).toBe(true);
    const outside = boxIntersectsFrustum({ x: 2, y: 2, z: 2 }, { x: 3, y: 3, z: 3 }, identityFrustum);
    expect(outside).toBe(false);
  });
});

describe('BSP traversal and visibility', () => {
  it('finds the containing leaf for a given point by descending nodes', () => {
    const map = makeTestMap();
    expect(findLeafForPoint(map, { x: 5, y: 0, z: 0 })).toBe(1);
    expect(findLeafForPoint(map, { x: -5, y: 0, z: 0 })).toBe(0);
  });

  it('returns faces in front-to-back order relative to the camera', () => {
    const map = makeTestMap();
    const faces = gatherVisibleFaces(map, { x: 5, y: 0, z: 0 }, identityFrustum);
    expect(faces.map((f) => f.faceIndex)).toEqual([1, 0]);
    expect(faces[0].sortKey).toBeGreaterThan(faces[1].sortKey);
  });

  it('applies frustum culling before PVS checks to match the rerelease traversal order', () => {
    const map = makeTestMap();
    const tightFrustum = extractFrustumPlanes([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      -0.5, 0, 0, 1,
    ]);
    const faces = gatherVisibleFaces(map, { x: 0.25, y: 0, z: 0 }, tightFrustum);
    expect(faces.map((f) => f.faceIndex)).toEqual([1]);
  });

  it('honors the PVS bitset; invisible clusters are skipped', () => {
    const map = makeTestMap();
    // Move camera into cluster 0; its PVS only includes itself.
    const faces = gatherVisibleFaces(map, { x: -2, y: 0, z: 0 }, identityFrustum);
    expect(faces.map((f) => f.faceIndex)).toEqual([0]);
  });

  it('treats missing or negative clusters as globally visible to match Quake II', () => {
    const map = makeTestMap();
    map.visibility = undefined;
    map.leafs[0] = { ...map.leafs[0], cluster: -1 };
    const faces = gatherVisibleFaces(map, { x: -2, y: 0, z: 0 }, identityFrustum);
    expect(faces.map((f) => f.faceIndex).sort()).toEqual([0, 1]);
  });
});
