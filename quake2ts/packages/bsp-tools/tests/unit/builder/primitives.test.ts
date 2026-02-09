import { describe, it, expect } from 'vitest';
import { box, hollowBox, wedge, stairs, cylinder } from '../../../src/builder/primitives.js';
import { type Vec3 } from '@quake2ts/shared';

describe('builder/primitives', () => {
  describe('box', () => {
    it('should create a 6-sided brush', () => {
      const origin: Vec3 = { x: 0, y: 0, z: 0 };
      const size: Vec3 = { x: 64, y: 64, z: 64 };
      const b = box({ origin, size });

      expect(b.sides).toHaveLength(6);
      expect(b.contents).toBeDefined();
    });

    it('should produce correct planes for a unit cube at origin', () => {
      const origin: Vec3 = { x: 0, y: 0, z: 0 };
      const size: Vec3 = { x: 2, y: 2, z: 2 }; // -1 to 1 in each axis
      const b = box({ origin, size });

      // Planes should correspond to maxs=1, mins=-1
      // Top: (0,0,1) d=1
      // Bottom: (0,0,-1) d=-(-1)=1
      // North: (0,1,0) d=1
      // South: (0,-1,0) d=1
      // East: (1,0,0) d=1
      // West: (-1,0,0) d=1

      const findPlane = (nx: number, ny: number, nz: number) =>
        b.sides.find(s =>
          s.plane.normal.x === nx &&
          s.plane.normal.y === ny &&
          s.plane.normal.z === nz
        );

      const top = findPlane(0, 0, 1);
      expect(top).toBeDefined();
      expect(top?.plane.dist).toBe(1);

      const bottom = findPlane(0, 0, -1);
      expect(bottom).toBeDefined();
      expect(bottom?.plane.dist).toBe(1); // -mins.z = -(-1) = 1

      const north = findPlane(0, 1, 0);
      expect(north).toBeDefined();
      expect(north?.plane.dist).toBe(1);

      const south = findPlane(0, -1, 0);
      expect(south).toBeDefined();
      expect(south?.plane.dist).toBe(1);
    });

    it('should handle texture assignment', () => {
      const b = box({
        origin: { x: 0, y: 0, z: 0 },
        size: { x: 10, y: 10, z: 10 },
        texture: 'test/texture'
      });

      expect(b.sides[0].texture.name).toBe('test/texture');
    });

    it('should handle per-face texture assignment', () => {
      const b = box({
        origin: { x: 0, y: 0, z: 0 },
        size: { x: 10, y: 10, z: 10 },
        texture: {
          top: { name: 'top_tex' },
          bottom: { name: 'bot_tex' }
        }
      });

      const findSide = (name: string) => b.sides.find(s => s.texture.name === name);
      expect(findSide('top_tex')).toBeDefined();
      expect(findSide('bot_tex')).toBeDefined();
    });
  });

  describe('hollowBox', () => {
    it('should create 6 brushes by default', () => {
      const brushes = hollowBox({
        origin: { x: 0, y: 0, z: 0 },
        size: { x: 100, y: 100, z: 100 },
        wallThickness: 4
      });

      expect(brushes).toHaveLength(6);
    });

    it('should omit sides when requested', () => {
      const brushes = hollowBox({
        origin: { x: 0, y: 0, z: 0 },
        size: { x: 100, y: 100, z: 100 },
        wallThickness: 4,
        sides: {
          top: false,
          bottom: true,
          north: true,
          south: true,
          east: true,
          west: true
        }
      });

      expect(brushes).toHaveLength(5);
    });

    it('should create brushes with thickness', () => {
      const origin = { x: 0, y: 0, z: 0 };
      const size = { x: 100, y: 100, z: 100 };
      const t = 10;

      const brushes = hollowBox({ origin, size, wallThickness: t });

      // Check top brush
      // Original maxs.z = 50. Top brush should range from 40 to 50 in Z.
      // Top brush center Z = (40 + 50) / 2 = 45.
      // Top brush height = 10.

      // Let's find the top brush (center z should be near 45)
      const topBrush = brushes.find(b => {
        // We can check planes to infer position, or simpler:
        // box() doesn't store origin, but we know the planes.
        // Top face plane: (0,0,1) dist 50.
        // Bottom face plane: (0,0,-1) dist -40.

        const topFace = b.sides.find(s => s.plane.normal.x === 0 && s.plane.normal.y === 0 && s.plane.normal.z === 1);
        const botFace = b.sides.find(s => s.plane.normal.x === 0 && s.plane.normal.y === 0 && s.plane.normal.z === -1);

        if (!topFace || !botFace) return false;
        return Math.abs(topFace.plane.dist - 50) < 0.1 && Math.abs(botFace.plane.dist - (-40)) < 0.1;
      });

      expect(topBrush).toBeDefined();
    });
  });

  describe('wedge', () => {
    it('should create a 6-sided brush (box modified)', () => {
      const w = wedge({
        origin: { x: 0, y: 0, z: 0 },
        size: { x: 100, y: 100, z: 50 },
        direction: 'north'
      });

      // Box has 6 sides. We removed top and added slope.
      expect(w.sides).toHaveLength(6);
    });

    it('should have a slope normal for north wedge', () => {
      const size = { x: 100, y: 100, z: 50 };
      const w = wedge({
        origin: { x: 0, y: 0, z: 0 },
        size,
        direction: 'north'
      });

      // Normal expected: (0, -z, y) normalized
      // (0, -50, 100) -> (0, -1, 2) normalized
      const len = Math.sqrt(50*50 + 100*100);
      const expectedY = -50 / len;
      const expectedZ = 100 / len;

      const slope = w.sides.find(s => Math.abs(s.plane.normal.x) < 0.001 && s.plane.normal.z > 0 && s.plane.normal.z < 0.99); // Not Z+ (top)

      expect(slope).toBeDefined();
      expect(slope?.plane.normal.x).toBeCloseTo(0);
      expect(slope?.plane.normal.y).toBeCloseTo(expectedY);
      expect(slope?.plane.normal.z).toBeCloseTo(expectedZ);
    });

    it('should have a slope normal for south wedge', () => {
      const size = { x: 100, y: 100, z: 50 };
      const w = wedge({
        origin: { x: 0, y: 0, z: 0 },
        size,
        direction: 'south'
      });

      // Normal expected: (0, z, y) normalized
      // (0, 50, 100) -> (0, 1, 2) normalized
      const len = Math.sqrt(50*50 + 100*100);
      const expectedY = 50 / len;
      const expectedZ = 100 / len;

      const slope = w.sides.find(s => Math.abs(s.plane.normal.x) < 0.001 && s.plane.normal.z > 0 && s.plane.normal.z < 0.99);

      expect(slope).toBeDefined();
      expect(slope?.plane.normal.y).toBeCloseTo(expectedY);
      expect(slope?.plane.normal.z).toBeCloseTo(expectedZ);
    });

    it('should have a slope normal for east wedge', () => {
        const size = { x: 100, y: 100, z: 50 };
        const w = wedge({
            origin: { x: 0, y: 0, z: 0 },
            size,
            direction: 'east'
        });

        // Low West (-x), High East (+x).
        // Normal: (-size.z, 0, size.x) -> (-50, 0, 100)
        const len = Math.sqrt(50*50 + 100*100);
        const expectedX = -50 / len;
        const expectedZ = 100 / len;

        const slope = w.sides.find(s => Math.abs(s.plane.normal.y) < 0.001 && s.plane.normal.z > 0 && s.plane.normal.z < 0.99);

        expect(slope).toBeDefined();
        expect(slope?.plane.normal.x).toBeCloseTo(expectedX);
        expect(slope?.plane.normal.z).toBeCloseTo(expectedZ);
    });
  });

  describe('stairs', () => {
    it('should create correct number of brushes', () => {
      const s = stairs({
        origin: { x: 0, y: 0, z: 0 },
        width: 64,
        height: 64,
        depth: 128,
        stepCount: 8,
        direction: 'north'
      });

      expect(s).toHaveLength(8);
    });

    it('should create steps ascending in Z and Y for north direction', () => {
      const height = 64;
      const depth = 128; // Total depth
      const count = 4;
      const stepHeight = height / count; // 16
      const stepDepth = depth / count; // 32

      const s = stairs({
        origin: { x: 0, y: 0, z: 0 },
        width: 64,
        height,
        depth,
        stepCount: count,
        direction: 'north'
      });

      // Mins Z is -32.
      // Step 0: maxs.z = -32 + 16 = -16.
      // Step 3: maxs.z = -32 + 64 = 32.

      // Step 0 Y center: mins.y + 16.
      // Step 3 Y center: mins.y + 3*32 + 16.

      // Verify height of first and last step
      // Height = maxs.z - mins.z.
      // For solid steps, they all start at floor (-32).
      // Step 0 height: 16. Step 3 height: 64.

      // We can check maxs.z of each step.
      // Since they are boxes, we can check top plane dist.

      // Sort by height
      const sorted = [...s].sort((a, b) => {
        const topA = a.sides.find(side => side.plane.normal.z === 1)?.plane.dist || 0;
        const topB = b.sides.find(side => side.plane.normal.z === 1)?.plane.dist || 0;
        return topA - topB;
      });

      const top0 = sorted[0].sides.find(side => side.plane.normal.z === 1)?.plane.dist;
      const top3 = sorted[3].sides.find(side => side.plane.normal.z === 1)?.plane.dist;

      // Origin z=0, height=64 -> maxs.z=32, mins.z=-32.
      // Step 0 top z: -32 + 16 = -16.
      // Step 3 top z: -32 + 64 = 32.

      expect(top0).toBeCloseTo(-16);
      expect(top3).toBeCloseTo(32);
    });
  });

  describe('cylinder', () => {
    it('should create a brush with N+2 sides', () => {
      const c = cylinder({
        origin: { x: 0, y: 0, z: 0 },
        radius: 32,
        height: 64,
        sides: 8
      });
      expect(c.sides).toHaveLength(10); // 8 sides + top + bottom
    });

    it('should have top and bottom planes', () => {
      const c = cylinder({
        origin: { x: 0, y: 0, z: 0 },
        radius: 32,
        height: 64,
        sides: 8
      });

      // Top: (0,0,1) dist 32
      const top = c.sides.find(s => s.plane.normal.z === 1);
      expect(top).toBeDefined();
      expect(top?.plane.dist).toBe(32);

      // Bottom: (0,0,-1) dist 32 (since -mins.z = -(-32) = 32)
      const bottom = c.sides.find(s => s.plane.normal.z === -1);
      expect(bottom).toBeDefined();
      expect(bottom?.plane.dist).toBe(32);
    });

    it('should generate convex hull', () => {
      const c = cylinder({
        origin: { x: 0, y: 0, z: 0 },
        radius: 32,
        height: 64,
        sides: 4
      });

      // For 4 sides starting at angle 0:
      // i=0: angle=0, normal=(1,0,0)
      // i=1: angle=PI/2, normal=(0,1,0)
      // i=2: angle=PI, normal=(-1,0,0)
      // i=3: angle=3PI/2, normal=(0,-1,0)

      const px = c.sides.find(s => s.plane.normal.x > 0.9);
      const py = c.sides.find(s => s.plane.normal.y > 0.9);
      const nx = c.sides.find(s => s.plane.normal.x < -0.9);
      const ny = c.sides.find(s => s.plane.normal.y < -0.9);

      expect(px).toBeDefined();
      expect(py).toBeDefined();
      expect(nx).toBeDefined();
      expect(ny).toBeDefined();
    });
  });
});
