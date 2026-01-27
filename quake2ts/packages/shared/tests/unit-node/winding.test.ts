import { describe, expect, it } from 'vitest';
import {
  type Winding,
  MAX_POINTS_ON_WINDING,
  MAX_WORLD_COORD,
  createWinding,
  copyWinding,
  reverseWinding,
  baseWindingForPlane,
} from '../../src/math/winding.js';
import { dotVec3, subtractVec3, crossVec3, normalizeVec3, type Vec3 } from '../../src/index.js';

describe('winding', () => {
  it('creates a new winding', () => {
    const w = createWinding(3);
    expect(w.numPoints).toBe(3);
    expect(w.points.length).toBe(3);
    expect(w.points[0]).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('copies a winding', () => {
    const w1 = createWinding(3);
    w1.points[0] = { x: 1, y: 2, z: 3 };

    const w2 = copyWinding(w1);
    expect(w2.numPoints).toBe(w1.numPoints);
    expect(w2.points[0]).toEqual(w1.points[0]);
    expect(w2.points).not.toBe(w1.points); // Deep copy check
    expect(w2.points[0]).not.toBe(w1.points[0]); // Vec3 copy check
  });

  it('reverses a winding', () => {
    const w1 = createWinding(3);
    w1.points[0] = { x: 1, y: 0, z: 0 };
    w1.points[1] = { x: 0, y: 1, z: 0 };
    w1.points[2] = { x: 0, y: 0, z: 1 };

    const w2 = reverseWinding(w1);
    expect(w2.numPoints).toBe(3);
    expect(w2.points[0]).toEqual(w1.points[2]);
    expect(w2.points[1]).toEqual(w1.points[1]);
    expect(w2.points[2]).toEqual(w1.points[0]);
  });

  it('creates a base winding for an axis-aligned plane (Z-up)', () => {
    const normal = { x: 0, y: 0, z: 1 };
    const dist = 0;
    const w = baseWindingForPlane(normal, dist);

    expect(w.numPoints).toBe(4);

    // Check all points are on the plane
    for (let i = 0; i < w.numPoints; i++) {
      const d = dotVec3(w.points[i], normal);
      expect(d).toBeCloseTo(dist);
    }

    // Check bounds roughly
    // With Z normal, we expect points to be at large +/- X, +/- Y coordinates
    // and Z=0
    // Algorithm:
    // vup = {1,0,0} (major axis is Z, so case 2)
    // vright = vup x normal = {1,0,0} x {0,0,1} = {0,-1,0}
    // points should be large

    // Actually wait, let's trace the implementation logic for Z normal
    // x = 2 (Z axis major)
    // vup = {1,0,0}
    // v = dot(vup, normal) = 0
    // vup remains {1,0,0}
    // org = {0,0,0}
    // vright = cross(vup, normal) = {1,0,0} x {0,0,1} = {0,-1,0}

    // p[0] = org - vright + vup = -{0,-1,0} + {1,0,0} = {0,1,0} + {1,0,0} = {1,1,0} * MAX_WORLD_COORD
    // p[1] = org + vright + vup = {0,-1,0} + {1,0,0} = {1,-1,0} * MAX_WORLD_COORD
    // p[2] = org + vright - vup = {0,-1,0} - {1,0,0} = {-1,-1,0} * MAX_WORLD_COORD
    // p[3] = org - vright - vup = -{0,-1,0} - {1,0,0} = {0,1,0} - {1,0,0} = {-1,1,0} * MAX_WORLD_COORD

    expect(Math.abs(w.points[0].x)).toBeCloseTo(MAX_WORLD_COORD);
    expect(Math.abs(w.points[0].y)).toBeCloseTo(MAX_WORLD_COORD);
    expect(w.points[0].z).toBeCloseTo(0);
  });

  it('creates a base winding for a generic plane', () => {
    // Normal (1, 1, 1) normalized
    const normal = normalizeVec3({ x: 1, y: 1, z: 1 });
    const dist = 100;
    const w = baseWindingForPlane(normal, dist);

    expect(w.numPoints).toBe(4);

    // Check coplanarity
    // Check that all points satisfy dot(p, normal) = dist
    for (let i = 0; i < w.numPoints; i++) {
      const d = dotVec3(w.points[i], normal);
      expect(d).toBeCloseTo(dist, 1); // Allow some tolerance due to large coordinates
    }

    // Check convexity / winding order?
    // Compute normal from triangle 0,1,2
    const v1 = subtractVec3(w.points[1], w.points[0]);
    const v2 = subtractVec3(w.points[2], w.points[0]);
    const computedNormal = normalizeVec3(crossVec3(v2, v1)); // v2 x v1 is wrong order for CCW?
    // q2tools WindingPlane: v1=p[1]-p[0], v2=p[2]-p[0], CrossProduct(v2, v1, normal)
    // Wait, q2tools code: CrossProduct(v2, v1, normal).
    // Usually normal is (p1-p0) x (p2-p0).

    // Let's check `q2tools/src/polylib.c` again for WindingPlane:
    // VectorSubtract(w->p[1], w->p[0], v1);
    // VectorSubtract(w->p[2], w->p[0], v2);
    // CrossProduct(v2, v1, normal);

    // CrossProduct(a,b) = a x b.
    // So (p2-p0) x (p1-p0).
    // This implies clockwise winding?
    // If standard right-hand rule, (p1-p0) x (p2-p0) gives normal out of CCW face.
    // (p2-p0) x (p1-p0) = - ((p1-p0) x (p2-p0)).
    // Quake uses clockwise winding for front face?

    // "When generating Quake 2 brush faces programmatically, vertices must be wound clockwise from the outside to ensure normals point outwards"
    // Memory says this.

    const computedNormalCross = crossVec3(v2, v1);
    const computedNormalNormalized = normalizeVec3(computedNormalCross);

    expect(computedNormalNormalized.x).toBeCloseTo(normal.x);
    expect(computedNormalNormalized.y).toBeCloseTo(normal.y);
    expect(computedNormalNormalized.z).toBeCloseTo(normal.z);
  });
});
