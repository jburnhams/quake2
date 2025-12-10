import { describe, it, expect, beforeEach } from 'vitest';
import { BspInspector } from '../../src/editor/bsp-inspector';
import { BspMap } from '../../src/bsp/bsp';
import { vec3 } from 'gl-matrix';

describe('BspInspector', () => {
  let mockBsp: BspMap;
  let inspector: BspInspector;

  beforeEach(() => {
    mockBsp = {
      planes: [
        { normal: vec3.fromValues(1, 0, 0), dist: 0, type: 0 } // x = 0 plane
      ],
      nodes: [
        {
          planeId: 0,
          children: [-2, -3], // Leaf 1 (index 1), Leaf 2 (index 2)
          mins: vec3.create(),
          maxs: vec3.create(),
          firstFace: 0,
          numFaces: 0
        }
      ],
      leaves: [
        { cluster: -1, area: 0, mins: vec3.create(), maxs: vec3.create(), firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0, contents: 0 }, // Leaf 0 (dummy)
        { cluster: 0, area: 0, mins: vec3.fromValues(0, -10, -10), maxs: vec3.fromValues(10, 10, 10), firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0, contents: 0 }, // Leaf 1 (front)
        { cluster: 1, area: 0, mins: vec3.fromValues(-10, -10, -10), maxs: vec3.fromValues(0, 10, 10), firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0, contents: 0 }  // Leaf 2 (back)
      ],
      surfaces: [
        { texInfoId: 0, planeId: 0, side: 0, firstEdge: 0, numEdges: 0, styles: [], lightmapId: 0 }
      ],
      texInfo: [
        { texture: 'wall_tex', flags: 0, value: 0, nextTexInfo: -1, vecS: vec3.create(), distS: 0, vecT: vec3.create(), distT: 0 }
      ],
      // ... other fields
    } as any;

    inspector = new BspInspector(mockBsp);
  });

  it('should find leaf containing point', () => {
    // Point at (1, 0, 0) should be in front of plane x=0 -> child 0 -> leaf 1 -> index -2 -> -( -2 + 1) -> 1?
    // Wait, children: positive is node index, negative is -(leaf_index + 1).
    // so -2 means leaf index 1.

    // Front of plane (1,0,0) with dist 0 is x > 0.
    const pointFront = vec3.fromValues(5, 0, 0);
    const leafFront = inspector.findLeafContainingPoint(pointFront);
    expect(leafFront).toBe(1);

    const pointBack = vec3.fromValues(-5, 0, 0);
    const leafBack = inspector.findLeafContainingPoint(pointBack);
    expect(leafBack).toBe(2);
  });

  it('should get leaf bounds', () => {
    const bounds = inspector.getLeafBounds(1);
    expect(bounds.mins[0]).toBe(0);
    expect(bounds.maxs[0]).toBe(10);
  });

  it('should get leaf cluster', () => {
    expect(inspector.getLeafCluster(1)).toBe(0);
    expect(inspector.getLeafCluster(2)).toBe(1);
  });

  it('should find surfaces by texture', () => {
    const indices = inspector.getSurfacesByTexture('wall_tex');
    expect(indices).toEqual([0]);
  });

  it('should get all loaded textures', () => {
    const textures = inspector.getAllLoadedTextures();
    expect(textures.length).toBe(1);
    expect(textures[0].name).toBe('wall_tex');
  });
});
