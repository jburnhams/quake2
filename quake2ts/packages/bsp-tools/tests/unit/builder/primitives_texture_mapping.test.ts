import { describe, it, expect } from 'vitest';
import { hollowBox } from '../../../src/builder/primitives.js';

describe('builder/primitives texture mapping', () => {
  it('should map per-face textures to the correct visible faces of hollowBox walls', () => {
    const textures = {
      top: { name: 'texture_ceil' },
      bottom: { name: 'texture_floor' },
      north: { name: 'texture_north' },
      south: { name: 'texture_south' },
      east: { name: 'texture_east' },
      west: { name: 'texture_west' }
    };

    const brushes = hollowBox({
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 100, y: 100, z: 100 },
      wallThickness: 10,
      texture: textures
    });

    // Helper to find brush by thickness in main axis
    // For North brush (+Y), it should be thin in Y axis.
    const findBrush = (axis: 'x' | 'y' | 'z', sign: 1 | -1) => {
      return brushes.find(b => {
        // Construct target normal vector for outer face
        const targetNormal = { x: 0, y: 0, z: 0 };
        targetNormal[axis] = sign;

        // Find outer face (dist 50)
        const outerFace = b.sides.find(s =>
          s.plane.normal.x === targetNormal.x &&
          s.plane.normal.y === targetNormal.y &&
          s.plane.normal.z === targetNormal.z &&
          Math.abs(s.plane.dist - 50) < 0.1
        );

        if (!outerFace) return false;

        // Find opposite face (inner face)
        // Target normal is inverted
        const innerTargetNormal = { x: -targetNormal.x, y: -targetNormal.y, z: -targetNormal.z };

        const innerFace = b.sides.find(s =>
          s.plane.normal.x === innerTargetNormal.x &&
          s.plane.normal.y === innerTargetNormal.y &&
          s.plane.normal.z === innerTargetNormal.z &&
          Math.abs(s.plane.dist - (-40)) < 0.1
        );

        return !!innerFace;
      });
    };

    // Verify Floor (Bottom Brush, Thin in Z, at -Z)
    const floorBrush = findBrush('z', -1);
    expect(floorBrush).toBeDefined();
    if (floorBrush) {
      // Visible face is Top face (0,0,1).
      const visibleFace = floorBrush.sides.find(s =>
        s.plane.normal.z === 1
      );
      expect(visibleFace?.texture.name).toBe('texture_floor');
    }

    // Verify Ceiling (Top Brush, Thin in Z, at +Z)
    const ceilBrush = findBrush('z', 1);
    expect(ceilBrush).toBeDefined();
    if (ceilBrush) {
      // Visible face is Bottom face (0,0,-1).
      const visibleFace = ceilBrush.sides.find(s =>
        s.plane.normal.z === -1
      );
      expect(visibleFace?.texture.name).toBe('texture_ceil');
    }

    // Verify North Wall (Thin in Y, at +Y)
    const northBrush = findBrush('y', 1);
    expect(northBrush).toBeDefined();
    if (northBrush) {
      // Visible face is South face (0,-1,0).
      const visibleFace = northBrush.sides.find(s =>
        s.plane.normal.y === -1
      );
      expect(visibleFace?.texture.name).toBe('texture_north');
    }
  });
});
