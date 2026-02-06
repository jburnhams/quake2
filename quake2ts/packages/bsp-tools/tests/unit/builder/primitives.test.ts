import { describe, it, expect } from 'vitest';
import { box, hollowBox } from '../../../src/builder/primitives.js';
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
});
