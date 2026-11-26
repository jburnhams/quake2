// R_SetupFrame's two view clusters and CM_WriteAreaBits' area 0, on a two-leaf map: one plane at
// z = 0 with an empty leaf above it (cluster 0) and a leaf below (cluster 1), each cluster seeing
// only itself.
import { describe, expect, it } from 'vitest';
import { findViewPoint, isClusterInView, reachableAreasFrom } from '../../../src/render/bspTraversal';
import type { BspMap } from '../../../src/assets/bsp';

const WATER = 32;
const SOLID = 1;

function twoLeafMap(below: number): BspMap {
  const leaf = (contents: number, cluster: number) => ({
    contents,
    cluster,
    area: 1,
    mins: [-64, -64, -64] as [number, number, number],
    maxs: [64, 64, 64] as [number, number, number],
    firstLeafFace: 0,
    numLeafFaces: 0,
    firstLeafBrush: 0,
    numLeafBrushes: 0,
  });
  return {
    models: [{ headNode: 0 }],
    nodes: [{ planeIndex: 0, children: [-1, -2] }],
    planes: [{ normal: [0, 0, 1], dist: 0, type: 2 }],
    leafs: [leaf(0, 0), leaf(below, 1)],
    visibility: { numClusters: 2, clusters: [{ pvs: new Uint8Array([0b01]) }, { pvs: new Uint8Array([0b10]) }] },
    areas: [
      { numAreaPortals: 0, firstAreaPortal: 0 },
      { numAreaPortals: 0, firstAreaPortal: 0 },
    ],
    areaPortals: [],
  } as unknown as BspMap;
}

describe('the view point (R_SetupFrame)', () => {
  it('takes the cluster 16 units below an eye just above water as its second cluster', () => {
    const map = twoLeafMap(WATER);
    const view = findViewPoint(map, { x: 0, y: 0, z: 8 });
    expect(view).toMatchObject({ cluster: 0, cluster2: 1 });
    expect(isClusterInView(map.visibility, view, 1)).toBe(true);
  });

  it('looks 16 units up from an eye in water', () => {
    const view = findViewPoint(twoLeafMap(WATER), { x: 0, y: 0, z: -8 });
    expect(view).toMatchObject({ cluster: 1, cluster2: 0 });
  });

  it('keeps one cluster when the point below is in the same leaf or solid', () => {
    const high = findViewPoint(twoLeafMap(WATER), { x: 0, y: 0, z: 40 });
    expect(high).toMatchObject({ cluster: 0, cluster2: 0 });
    const map = twoLeafMap(SOLID);
    const overSolid = findViewPoint(map, { x: 0, y: 0, z: 8 });
    expect(overSolid).toMatchObject({ cluster: 0, cluster2: 0 });
    expect(isClusterInView(map.visibility, overSolid, 1)).toBe(false);
  });
});

describe('the areas in view (CM_WriteAreaBits)', () => {
  it('culls no area from area 0, and floods from any other', () => {
    const map = twoLeafMap(WATER);
    expect(reachableAreasFrom(map, 0, [])).toBeNull();
    expect(reachableAreasFrom(map, 1, [])).toEqual(new Set([1]));
    expect(reachableAreasFrom(map, 1, undefined)).toBeNull();
  });
});
