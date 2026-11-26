import { describe, it, expect } from 'vitest';
import { hollowBox } from '../../../src/builder/primitives.js';

describe('builder/primitives sides filtering', () => {
  it('should only create specified sides when a partial sides object is provided', () => {
    // Only 'top' should be created.
    // 'bottom' is undefined in the object, so it should be false/excluded.
    const brushes = hollowBox({
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 100, y: 100, z: 100 },
      wallThickness: 10,
      sides: {
        top: true
        // others undefined
      }
    });

    expect(brushes).toHaveLength(1);

    // Check that the created brush is indeed the top brush (max Z)
    // Top brush center Z should be positive.
    const brush = brushes[0];
    const topPlane = brush.sides.find(s => s.plane.normal.z === 1);
    // For box size 100, top is at +50.
    expect(topPlane?.plane.dist).toBe(50);
  });

  it('should create no sides if an empty object is provided', () => {
    const brushes = hollowBox({
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 100, y: 100, z: 100 },
      wallThickness: 10,
      sides: {} as any
    });

    expect(brushes).toHaveLength(0);
  });
});
