import { describe, it, expect } from 'vitest';
import { BSP_LIMITS, PLANE_X, planeTypeForNormal } from '@quake2ts/bsp-tools';
import { createBoxRoom } from '../fixtures/maps/box.js';
import { writeMapFile, createBoxBrush } from '../fixtures/mapWriter.js';
import { crossVec3, normalizeVec3, subtractVec3 } from '@quake2ts/shared';

describe('BSP Tools Setup', () => {
  it('should export BSP constants', () => {
    expect(BSP_LIMITS.MAX_MAP_BRUSHES).toBe(8192);
    expect(PLANE_X).toBe(0);
  });

  it('should correctly identify plane types', () => {
    expect(planeTypeForNormal({ x: 1, y: 0, z: 0 })).toBe(0); // PLANE_X
    expect(planeTypeForNormal({ x: 0, y: 1, z: 0 })).toBe(1); // PLANE_Y
    expect(planeTypeForNormal({ x: 0, y: 0, z: 1 })).toBe(2); // PLANE_Z
  });

  it('should generate a map file string', () => {
    const room = createBoxRoom(64, 8);
    const mapContent = writeMapFile(room);

    expect(mapContent).toContain('"classname" "worldspawn"');
    expect(mapContent).toContain('"message" "Test Box Room"');
    expect(mapContent).toContain('"classname" "info_player_start"');
    // Check for brush content (Floor brush, Front face +Y)
    // Floor is 0..64 in X/Y, 0..8 in Z
    // Front face points: (0, 64, 8) -> (64, 64, 8) -> (0, 64, 0)
    expect(mapContent).toContain('( 0 64 8 ) ( 64 64 8 ) ( 0 64 0 )');
  });

  it('should generate correct winding order (normals facing out)', () => {
    const brush = createBoxBrush({ x: 0, y: 0, z: 0 }, { x: 100, y: 100, z: 100 });

    // Check Top Face (+Z)
    // Points should be at z=100
    const topFace = brush.sides.find(s => s.plane[0].z === 100 && s.plane[1].z === 100 && s.plane[2].z === 100);
    expect(topFace).toBeDefined();
    if (topFace) {
      const [p1, p2, p3] = topFace.plane;
      const v1 = subtractVec3(p2, p1);
      const v2 = subtractVec3(p3, p1);
      const normal = normalizeVec3(crossVec3(v1, v2));
      expect(normal.x).toBeCloseTo(0);
      expect(normal.y).toBeCloseTo(0);
      expect(normal.z).toBeCloseTo(1); // +Z
    }

    // Check Right Face (+X)
    // Points should be at x=100
    const rightFace = brush.sides.find(s => s.plane[0].x === 100 && s.plane[1].x === 100 && s.plane[2].x === 100);
    expect(rightFace).toBeDefined();
    if (rightFace) {
      const [p1, p2, p3] = rightFace.plane;
      const v1 = subtractVec3(p2, p1);
      const v2 = subtractVec3(p3, p1);
      const normal = normalizeVec3(crossVec3(v1, v2));
      expect(normal.x).toBeCloseTo(1); // +X
      expect(normal.y).toBeCloseTo(0);
      expect(normal.z).toBeCloseTo(0);
    }
  });
});
