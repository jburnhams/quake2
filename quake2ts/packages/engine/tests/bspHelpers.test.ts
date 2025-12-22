import { describe, expect, it } from 'vitest';
import { parseBsp } from '../src/assets/bsp.js';
import { buildTestBsp, encodedVisForClusters } from './helpers/bspBuilder.js';

describe('BspMap Helpers', () => {
  it('correctly finds leaf in a simple split', () => {
     const buffer = buildTestBsp({
      planes: [{ normal: [1, 0, 0], dist: 0, type: 0 }],
      nodes: [
        // Plane X=0. Front child (X>0) -> Leaf 0 (index -1). Back child (X<=0) -> Leaf 1 (index -2).
        { planeIndex: 0, children: [-1, -2], mins: [-64, -64, -64], maxs: [64, 64, 64], firstFace: 0, numFaces: 0 },
      ],
      leafs: [
        { contents: 0, cluster: 10, area: 0, mins: [0, 0, 0], maxs: [0, 0, 0], firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0 },
        { contents: 0, cluster: 20, area: 0, mins: [0, 0, 0], maxs: [0, 0, 0], firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0 },
      ],
      models: [
        { mins: [-64, -64, -64], maxs: [64, 64, 64], origin: [0, 0, 0], headNode: 0, firstFace: 0, numFaces: 0 },
      ],
      visibility: encodedVisForClusters(2, [[0xFF], [0xEE]])
    });
    const bsp = parseBsp(buffer);

    const leafFront = bsp.findLeaf([10, 0, 0]);
    expect(leafFront.cluster).toBe(10);

    const leafBack = bsp.findLeaf([-10, 0, 0]);
    expect(leafBack.cluster).toBe(20);
  });

  it('calculates PVS for a point', () => {
    const buffer = buildTestBsp({
      planes: [{ normal: [1, 0, 0], dist: 0, type: 0 }],
      nodes: [
        { planeIndex: 0, children: [-1, -2], mins: [-64, -64, -64], maxs: [64, 64, 64], firstFace: 0, numFaces: 0 },
      ],
      leafs: [
        { contents: 0, cluster: 0, area: 0, mins: [0, 0, 0], maxs: [0, 0, 0], firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0 },
        { contents: 0, cluster: 1, area: 0, mins: [0, 0, 0], maxs: [0, 0, 0], firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0 },
      ],
      models: [
        { mins: [-64, -64, -64], maxs: [64, 64, 64], origin: [0, 0, 0], headNode: 0, firstFace: 0, numFaces: 0 },
      ],
      visibility: encodedVisForClusters(2, [[0xAA], [0xBB]])
    });
    const bsp = parseBsp(buffer);

    const pvsFront = bsp.calculatePVS([10, 0, 0]);
    expect(pvsFront).toBeDefined();
    expect(pvsFront![0]).toBe(0xAA);

    const pvsBack = bsp.calculatePVS([-10, 0, 0]);
    expect(pvsBack).toBeDefined();
    expect(pvsBack![0]).toBe(0xBB);
  });

  it('returns undefined PVS if leaf has no cluster (-1)', () => {
      const buffer = buildTestBsp({
      planes: [{ normal: [1, 0, 0], dist: 0, type: 0 }],
      nodes: [
        { planeIndex: 0, children: [-1, -1], mins: [-64, -64, -64], maxs: [64, 64, 64], firstFace: 0, numFaces: 0 },
      ],
      leafs: [
        { contents: 0, cluster: -1, area: 0, mins: [0, 0, 0], maxs: [0, 0, 0], firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0 },
      ],
      models: [
        { mins: [-64, -64, -64], maxs: [64, 64, 64], origin: [0, 0, 0], headNode: 0, firstFace: 0, numFaces: 0 },
      ],
      visibility: encodedVisForClusters(1, [[0xFF]])
    });
    const bsp = parseBsp(buffer);
    expect(bsp.calculatePVS([10, 0, 0])).toBeUndefined();
  });
});
