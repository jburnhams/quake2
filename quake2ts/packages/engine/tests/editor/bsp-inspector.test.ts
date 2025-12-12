import { describe, it, expect, beforeEach } from 'vitest';
import { BspInspector } from '../../src/editor/bsp-inspector';
import { BspMap } from '../../src/assets/bsp'; // Fixed import path
import { vec3 } from 'gl-matrix';

describe('BspInspector', () => {
  let mockBsp: BspMap;
  let inspector: BspInspector;

  beforeEach(() => {
    mockBsp = {
      planes: [
        { normal: [1, 0, 0], dist: 0, type: 0 }, // x = 0 plane. Normal is [x,y,z] array
        { normal: [0, 1, 0], dist: 0, type: 0 }  // y = 0 plane.
      ],
      nodes: [
        {
          planeIndex: 0,
          children: [-2, -3], // Leaf 1 (index 1), Leaf 2 (index 2)
          mins: [0,0,0],
          maxs: [0,0,0],
          firstFace: 0,
          numFaces: 0
        }
      ],
      leafs: [
        { cluster: -1, area: 0, mins: [0,0,0], maxs: [0,0,0], firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0, contents: 0 }, // Leaf 0 (dummy)
        { cluster: 0, area: 0, mins: [0, -10, -10], maxs: [10, 10, 10], firstLeafFace: 0, numLeafFaces: 1, firstLeafBrush: 0, numLeafBrushes: 0, contents: 0 }, // Leaf 1 (front)
        { cluster: 1, area: 0, mins: [-10, -10, -10], maxs: [0, 10, 10], firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0, contents: 0 }  // Leaf 2 (back)
      ],
      leafLists: {
          leafFaces: [
              [],
              [0], // Leaf 1 has face 0
              []
          ],
          leafBrushes: [[], [], []]
      },
      faces: [
        { texInfo: 0, planeIndex: 0, side: 0, firstEdge: 0, numEdges: 3, styles: [0, 0, 0, 0], lightOffset: 0 } // Face 0 on plane 0
      ],
      texInfo: [
        { texture: 'wall_tex', flags: 0, value: 0, nextTexInfo: -1, s: [0,0,0], sOffset: 0, t: [0,0,0], tOffset: 0 }
      ],
      surfEdges: new Int32Array([0, 1, 2]),
      edges: [
          { vertices: [0, 1] },
          { vertices: [1, 2] },
          { vertices: [2, 0] }
      ],
      vertices: [
          [0, 0, 0],
          [0, 10, 0],
          [0, 0, 10]
      ],
      visibility: {
          numClusters: 2,
          clusters: [
              { pvs: new Uint8Array([255]), phs: new Uint8Array([255]) },
              { pvs: new Uint8Array([255]), phs: new Uint8Array([255]) }
          ]
      }
      // ... other fields
    } as any;

    inspector = new BspInspector(mockBsp);
  });

  it('should find leaf containing point', () => {
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
    expect(bounds.mins.x).toBe(0);
    expect(bounds.maxs.x).toBe(10);
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

  it('should get surface at point with complete info', () => {
      // Face 0 is on plane x=0.
      // Leaf 1 contains this face.
      // Point needs to be close to x=0 and inside Leaf 1?
      // Wait, findLeafContainingPoint(5, 0, 0) returns Leaf 1.
      // But point (5,0,0) is distance 5 from plane x=0. EPSILON is 1.0.
      // So we need a point in Leaf 1 that is close to the plane.
      // Leaf 1 bounds: x [0, 10].
      // Point (0.5, 0, 0) is inside Leaf 1 (since x >= 0) and dist is 0.5 < 1.0.

      const point = vec3.fromValues(0.5, 0, 0);
      const surface = inspector.getSurfaceAtPoint(point);

      expect(surface).not.toBeNull();
      if (surface) {
          expect(surface.textureName).toBe('wall_tex');
          expect(surface.lightmapId).toBe(0);
          expect(surface.normal[0]).toBe(1);

          // Verify Plane
          expect(surface.plane.normal[0]).toBe(1);
          expect(surface.plane.dist).toBe(0);

          // Verify Vertices
          expect(surface.vertices.length).toBe(3);
          // v0: 0,0,0
          expect(surface.vertices[0][0]).toBe(0);
          expect(surface.vertices[0][1]).toBe(0);
          // v1: 0,10,0
          expect(surface.vertices[1][1]).toBe(10);
          // v2: 0,0,10
          expect(surface.vertices[2][2]).toBe(10);
      }
  });
});
