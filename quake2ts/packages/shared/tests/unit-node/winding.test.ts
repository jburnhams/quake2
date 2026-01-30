import { describe, expect, it } from 'vitest';
import {
  type Winding,
  MAX_POINTS_ON_WINDING,
  MAX_WORLD_COORD,
  createWinding,
  copyWinding,
  reverseWinding,
  baseWindingForPlane,
  windingOnPlaneSide,
  clipWinding,
  splitWinding,
  windingArea,
  windingBounds,
  windingCenter,
  windingPlane,
  pointInWinding,
  validateWinding,
  chopWindingByPlanes,
  removeColinearPoints,
  SIDE_FRONT,
  SIDE_BACK,
  SIDE_ON,
  SIDE_CROSS,
} from '../../src/math/winding.js';
import {
  dotVec3,
  subtractVec3,
  crossVec3,
  normalizeVec3,
  type Vec3,
  vec3Equals,
} from '../../src/index.js';

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

    // Check that the points form a large square on the XY plane.

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

    // Check that the generated winding has the correct orientation. Quake2 uses a
    // clockwise winding order for front-facing polygons, so the calculated normal
    // from the points should match the input normal.
    const v1 = subtractVec3(w.points[1], w.points[0]);
    const v2 = subtractVec3(w.points[2], w.points[0]);
    // The cross product (p2-p0) x (p1-p0) is used to get the normal for a clockwise winding.
    const computedNormalNormalized = normalizeVec3(crossVec3(v2, v1));

    expect(computedNormalNormalized.x).toBeCloseTo(normal.x);
    expect(computedNormalNormalized.y).toBeCloseTo(normal.y);
    expect(computedNormalNormalized.z).toBeCloseTo(normal.z);
  });

  describe('windingOnPlaneSide', () => {
    it('correctly classifies a winding in front of a plane', () => {
      const w = createWinding(3);
      w.points[0] = { x: 10, y: 0, z: 0 };
      w.points[1] = { x: 0, y: 10, z: 0 };
      w.points[2] = { x: 0, y: 0, z: 10 };
      // Plane at x=0, pointing +x. Points are at x>=0. Wait.
      // x=10 is front. x=0 is on (dist=0).
      // Let's use a plane at x=-10, pointing +x.
      const normal = { x: 1, y: 0, z: 0 };
      const dist = -5; // plane is at x=-5
      // points are at x=10, 0, 0. All > -5.
      expect(windingOnPlaneSide(w, normal, dist)).toBe(SIDE_FRONT);
    });

    it('correctly classifies a winding behind a plane', () => {
      const w = createWinding(3);
      w.points[0] = { x: -10, y: 0, z: 0 };
      w.points[1] = { x: -20, y: 10, z: 0 };
      w.points[2] = { x: -20, y: 0, z: 10 };
      // Plane at x=0
      const normal = { x: 1, y: 0, z: 0 };
      const dist = 0;
      expect(windingOnPlaneSide(w, normal, dist)).toBe(SIDE_BACK);
    });

    it('correctly classifies a winding crossing a plane', () => {
      const w = createWinding(3);
      w.points[0] = { x: 10, y: 0, z: 0 };
      w.points[1] = { x: -10, y: 10, z: 0 };
      w.points[2] = { x: 0, y: 0, z: 10 };
      // Plane at x=0
      const normal = { x: 1, y: 0, z: 0 };
      const dist = 0;
      expect(windingOnPlaneSide(w, normal, dist)).toBe(SIDE_CROSS);
    });

    it('correctly classifies a winding on a plane', () => {
      const w = createWinding(3);
      w.points[0] = { x: 0, y: 0, z: 0 };
      w.points[1] = { x: 0, y: 10, z: 0 };
      w.points[2] = { x: 0, y: 0, z: 10 };
      // Plane at x=0
      const normal = { x: 1, y: 0, z: 0 };
      const dist = 0;
      expect(windingOnPlaneSide(w, normal, dist)).toBe(SIDE_ON);
    });
  });

  describe('clipWinding', () => {
    it('returns copy if entirely in front', () => {
      const w = createWinding(3);
      w.points[0] = { x: 10, y: 0, z: 0 };
      w.points[1] = { x: 10, y: 10, z: 0 };
      w.points[2] = { x: 10, y: 0, z: 10 };

      const res = clipWinding(w, { x: 1, y: 0, z: 0 }, 0, true);
      expect(res).not.toBeNull();
      expect(res!.numPoints).toBe(3);
      expect(res!.points).toEqual(w.points);
    });

    it('returns null if entirely behind', () => {
      const w = createWinding(3);
      w.points[0] = { x: -10, y: 0, z: 0 };
      w.points[1] = { x: -10, y: 10, z: 0 };
      w.points[2] = { x: -10, y: 0, z: 10 };

      const res = clipWinding(w, { x: 1, y: 0, z: 0 }, 0, true);
      expect(res).toBeNull();
    });

    it('clips a square into a triangle with a diagonal plane', () => {
      // Square on Z=0, -10 to 10 on X and Y
      const w = createWinding(4);
      w.points[0] = { x: 10, y: 10, z: 0 };
      w.points[1] = { x: 10, y: -10, z: 0 };
      w.points[2] = { x: -10, y: -10, z: 0 };
      w.points[3] = { x: -10, y: 10, z: 0 };

      // Cut with plane X=Y (normal (-1, 1, 0) normalized or similar)
      // Let's use plane normal (1, 1, 0) dist 0.
      // Points where x+y > 0 are front.
      // (10, 10) -> 20 > 0 (Front)
      // (10, -10) -> 0 (On)
      // (-10, -10) -> -20 < 0 (Back)
      // (-10, 10) -> 0 (On)

      const normal = normalizeVec3({ x: 1, y: 1, z: 0 });
      const dist = 0;

      const res = clipWinding(w, normal, dist, true);
      expect(res).not.toBeNull();

      // Should have points (10,10), (10,-10), (-10,10)
      // And maybe intersection points if it wasn't exactly on vertices.
      // Here (10,-10) and (-10,10) are ON. (10,10) is FRONT. (-10,-10) is BACK.
      // So it keeps (10,10), (10,-10), (-10,10).
      // Order might vary but it should be a triangle (3 points).

      expect(res!.numPoints).toBe(3);

      // Verify all points are front or on
      for(const p of res!.points) {
        expect(dotVec3(p, normal)).toBeGreaterThanOrEqual(-0.001);
      }
    });
  });

  describe('splitWinding', () => {
    it('splits a square into two polygons', () => {
      const w = createWinding(4);
      w.points[0] = { x: 10, y: 10, z: 0 };
      w.points[1] = { x: 10, y: -10, z: 0 };
      w.points[2] = { x: -10, y: -10, z: 0 };
      w.points[3] = { x: -10, y: 10, z: 0 };

      // Plane x=0
      const normal = { x: 1, y: 0, z: 0 };
      const dist = 0;

      const { front, back } = splitWinding(w, normal, dist);

      expect(front).not.toBeNull();
      expect(back).not.toBeNull();

      expect(front!.numPoints).toBe(4); // Rectangle on x>=0
      expect(back!.numPoints).toBe(4); // Rectangle on x<=0

      // Verify front points
      for(const p of front!.points) {
        expect(p.x).toBeGreaterThanOrEqual(-0.001);
      }

      // Verify back points
      for(const p of back!.points) {
        expect(p.x).toBeLessThanOrEqual(0.001);
      }
    });

    it('preserves total area after split', () => {
      const w = createWinding(4);
      w.points[0] = { x: 10, y: 10, z: 0 };
      w.points[1] = { x: 10, y: -10, z: 0 };
      w.points[2] = { x: -10, y: -10, z: 0 };
      w.points[3] = { x: -10, y: 10, z: 0 };

      const totalArea = windingArea(w); // 400

      // Arbitrary diagonal split
      const normal = normalizeVec3({ x: 1, y: 2, z: 0 });
      const dist = 0;

      const { front, back } = splitWinding(w, normal, dist);

      expect(front).not.toBeNull();
      expect(back).not.toBeNull();

      const frontArea = windingArea(front!);
      const backArea = windingArea(back!);

      expect(frontArea + backArea).toBeCloseTo(totalArea);
    });
  });

  describe('winding geometry', () => {
    it('calculates area of a square', () => {
      const w = createWinding(4);
      w.points[0] = { x: 0, y: 10, z: 0 };
      w.points[1] = { x: 10, y: 10, z: 0 };
      w.points[2] = { x: 10, y: 0, z: 0 };
      w.points[3] = { x: 0, y: 0, z: 0 };

      const area = windingArea(w);
      expect(area).toBeCloseTo(100);
    });

    it('calculates area of a triangle', () => {
      const w = createWinding(3);
      w.points[0] = { x: 0, y: 0, z: 0 };
      w.points[1] = { x: 10, y: 0, z: 0 };
      w.points[2] = { x: 0, y: 10, z: 0 };

      const area = windingArea(w);
      expect(area).toBeCloseTo(50);
    });

    it('calculates bounds', () => {
      const w = createWinding(3);
      w.points[0] = { x: -5, y: -5, z: -5 };
      w.points[1] = { x: 10, y: 0, z: 0 };
      w.points[2] = { x: 0, y: 20, z: 5 };

      const bounds = windingBounds(w);
      expect(bounds.mins).toEqual({ x: -5, y: -5, z: -5 });
      expect(bounds.maxs).toEqual({ x: 10, y: 20, z: 5 });
    });

    it('calculates center', () => {
      const w = createWinding(4);
      w.points[0] = { x: -10, y: 10, z: 0 };
      w.points[1] = { x: 10, y: 10, z: 0 };
      w.points[2] = { x: 10, y: -10, z: 0 };
      w.points[3] = { x: -10, y: -10, z: 0 };

      const center = windingCenter(w);
      expect(center.x).toBeCloseTo(0);
      expect(center.y).toBeCloseTo(0);
      expect(center.z).toBeCloseTo(0);
    });

    it('derives plane from winding', () => {
      const normal = { x: 0, y: 0, z: 1 };
      const w = baseWindingForPlane(normal, 10);
      const plane = windingPlane(w);

      expect(plane.normal.x).toBeCloseTo(normal.x);
      expect(plane.normal.y).toBeCloseTo(normal.y);
      expect(plane.normal.z).toBeCloseTo(normal.z);
      expect(plane.dist).toBeCloseTo(10);
    });
  });

  describe('validation', () => {
    it('validates a correct triangle', () => {
      const w = createWinding(3);
      w.points[0] = { x: 0, y: 0, z: 0 };
      w.points[1] = { x: 10, y: 0, z: 0 };
      w.points[2] = { x: 0, y: 10, z: 0 };
      const res = validateWinding(w);
      expect(res.valid).toBe(true);
    });

    it('fails degenerate winding (2 points)', () => {
      const w = createWinding(2);
      w.points[0] = { x: 0, y: 0, z: 0 };
      w.points[1] = { x: 10, y: 0, z: 0 };
      const res = validateWinding(w);
      expect(res.valid).toBe(false);
      expect(res.errors[0]).toContain('Not enough points');
    });

    it('fails non-coplanar points', () => {
      const w = createWinding(4);
      w.points[0] = { x: 0, y: 0, z: 0 };
      w.points[1] = { x: 10, y: 0, z: 0 };
      w.points[2] = { x: 10, y: 10, z: 0 };
      w.points[3] = { x: 0, y: 10, z: 5 }; // Raised point, bent quad
      const res = validateWinding(w);
      expect(res.valid).toBe(false);
      // It might fail on off-plane or concave/bad normal
      expect(res.errors.some(e => e.includes('off plane') || e.includes('Concave'))).toBe(true);
    });

    it('detects point in winding', () => {
      const w = createWinding(4);
      w.points[0] = { x: -10, y: 10, z: 0 };
      w.points[1] = { x: 10, y: 10, z: 0 };
      w.points[2] = { x: 10, y: -10, z: 0 };
      w.points[3] = { x: -10, y: -10, z: 0 };

      const normal = { x: 0, y: 0, z: 1 };

      expect(pointInWinding({ x: 0, y: 0, z: 0 }, w, normal)).toBe(true);
      expect(pointInWinding({ x: 20, y: 0, z: 0 }, w, normal)).toBe(false);
    });
  });

  describe('chopWindingByPlanes', () => {
    it('chops a large winding to a box', () => {
      // Start with base winding on Z=0
      const w = baseWindingForPlane({ x: 0, y: 0, z: 1 }, 0);

      // Define 4 planes of a 20x20 box centered at origin
      // x=10 (normal 1,0,0 dist 10)
      // x=-10 (normal -1,0,0 dist 10) -> wait, standard brush planes point OUT
      // So right face (x=10): normal (1,0,0), dist 10. Points inside have x<10. d = x*1 - 10 < 0. Back side. Correct.
      // Left face (x=-10): normal (-1,0,0), dist 10. Points inside have x>-10 -> -x < 10 -> -x - 10 < 0. Back side. Correct.
      // y=10: normal (0,1,0), dist 10.
      // y=-10: normal (0,-1,0), dist 10.

      const planes = [
        { normal: { x: 1, y: 0, z: 0 }, dist: 10 },
        { normal: { x: -1, y: 0, z: 0 }, dist: 10 },
        { normal: { x: 0, y: 1, z: 0 }, dist: 10 },
        { normal: { x: 0, y: -1, z: 0 }, dist: 10 },
      ];

      const chopped = chopWindingByPlanes(w, planes);

      expect(chopped).not.toBeNull();
      expect(chopped!.numPoints).toBe(4); // Should be a square

      const bounds = windingBounds(chopped!);
      expect(bounds.mins.x).toBeCloseTo(-10);
      expect(bounds.maxs.x).toBeCloseTo(10);
      expect(bounds.mins.y).toBeCloseTo(-10);
      expect(bounds.maxs.y).toBeCloseTo(10);
    });
  });

  describe('removeColinearPoints', () => {
    it('removes unnecessary points from a straight edge', () => {
      const w = createWinding(5);
      w.points[0] = { x: 0, y: 0, z: 0 };
      w.points[1] = { x: 5, y: 0, z: 0 }; // Midpoint on bottom edge
      w.points[2] = { x: 10, y: 0, z: 0 };
      w.points[3] = { x: 10, y: 10, z: 0 };
      w.points[4] = { x: 0, y: 10, z: 0 };

      expect(w.numPoints).toBe(5);

      const simplified = removeColinearPoints(w);

      expect(simplified.numPoints).toBe(4);
      // p[1] (5,0,0) should be gone
      // New points: (0,0,0), (10,0,0), (10,10,0), (0,10,0)
      expect(simplified.points[0]).toEqual({ x: 0, y: 0, z: 0 });
      expect(simplified.points[1]).toEqual({ x: 10, y: 0, z: 0 });
      expect(simplified.points[2]).toEqual({ x: 10, y: 10, z: 0 });
      expect(simplified.points[3]).toEqual({ x: 0, y: 10, z: 0 });
    });
  });
});
