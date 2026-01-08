import { describe, it, expect } from 'vitest';
import {
  clipBoxToBrush,
  CollisionBrush,
  CollisionPlane,
  CollisionTraceResult,
  createDefaultTrace,
  TraceResult,
  computePlaneSignBits
} from '../../../src/bsp/collision.js';
import { Vec3 } from '../../../src/math/vec3.js';

describe('Trace System Verification', () => {
  const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

  // Helper to create a simple plane
  function createPlane(normal: Vec3, dist: number): CollisionPlane {
    return {
      normal,
      dist,
      type: 0, // Not used in clipBoxToBrush logic directly
      signbits: computePlaneSignBits(normal)
    };
  }

  // Helper to create a simple box brush
  // Mins/Maxs define the brush extent.
  // Planes point OUTWARDS.
  function createBoxBrush(mins: Vec3, maxs: Vec3, contents = 1): CollisionBrush {
    const planes: CollisionPlane[] = [
      createPlane({ x: 1, y: 0, z: 0 }, maxs.x),
      createPlane({ x: -1, y: 0, z: 0 }, -mins.x),
      createPlane({ x: 0, y: 1, z: 0 }, maxs.y),
      createPlane({ x: 0, y: -1, z: 0 }, -mins.y),
      createPlane({ x: 0, y: 0, z: 1 }, maxs.z),
      createPlane({ x: 0, y: 0, z: -1 }, -mins.z),
    ];

    return {
      contents,
      sides: planes.map(p => ({ plane: p, surfaceFlags: 0 }))
    };
  }

  describe('clipBoxToBrush', () => {
    it('should correctly handle signed bbox offsets (expanding the brush)', () => {
      // Brush from -10 to 10 on X
      const brush = createBoxBrush({ x: -10, y: -10, z: -10 }, { x: 10, y: 10, z: 10 });
      // Trace Box size: -5 to 5
      const mins = { x: -5, y: -5, z: -5 };
      const maxs = { x: 5, y: 5, z: 5 };

      // We trace a point (start=end) to check containment
      // Effectively checking if point is inside Expanded Brush.
      // Expanded brush should be:
      // X: [-10, 10] expanded by 5 -> [-15, 15]
      // Because box is symmetric size 10 (radius 5).

      const trace = createDefaultTrace();

      // Test point at 14, 0, 0. Should be inside (startsolid).
      // Point 14: 14 < 15. True. Inside.
      clipBoxToBrush({
        start: { x: 14, y: 0, z: 0 },
        end: { x: 14, y: 0, z: 0 },
        mins, maxs,
        brush, trace
      });
      expect(trace.startsolid).toBe(true);

      // Point 16: 16 > 15. False. Outside.
      const trace2 = createDefaultTrace();
      clipBoxToBrush({
        start: { x: 16, y: 0, z: 0 },
        end: { x: 16, y: 0, z: 0 },
        mins, maxs,
        brush, trace: trace2
      });
      expect(trace2.startsolid).toBe(false);
    });

    it('should verify startsolid detection matches original (on plane boundary)', () => {
      const brush = createBoxBrush({ x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 });
      // Box size 0 (point)
      const mins = ZERO;
      const maxs = ZERO;

      // Plane x=10. Normal (1,0,0). Dist 10.
      // Point at 10.
      // dist to plane: 1*10 + ... - 10 = 0.
      // d1 = 0.
      // check: if (d1 > 0) startout = true.
      // 0 is not > 0. So startout = false.
      // So on plane = inside.

      const trace = createDefaultTrace();
      clipBoxToBrush({
        start: { x: 10, y: 5, z: 5 },
        end: { x: 10, y: 5, z: 5 },
        mins, maxs,
        brush, trace
      });
      expect(trace.startsolid).toBe(true);

      // Point at 10.001
      const trace2 = createDefaultTrace();
      clipBoxToBrush({
        start: { x: 10.001, y: 5, z: 5 },
        end: { x: 10.001, y: 5, z: 5 },
        mins, maxs,
        brush, trace: trace2
      });
      expect(trace2.startsolid).toBe(false);
    });

    it('should handle epsilon correctly for grazing edges', () => {
      // clipBoxToBrush uses DIST_EPSILON (0.03125) for enter/leave fraction
      // but NOT for startout check logic directly, except implicitly via logic flow?
      // No, strictly d1 > 0.

      const brush = createBoxBrush({ x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 });
      const mins = ZERO;
      const maxs = ZERO;

      // Trace from outside 11 to inside 9.
      // Hits plane at 10.
      // Fraction should be 0.5.

      const trace = createDefaultTrace();
      clipBoxToBrush({
        start: { x: 11, y: 5, z: 5 },
        end: { x: 9, y: 5, z: 5 },
        mins, maxs,
        brush, trace
      });

      // Hit x=10.
      // d1 (start) = 11 - 10 = 1.
      // d2 (end) = 9 - 10 = -1.
      // enterfrac = (1 - epsilon) / (1 - -1) = (1 - 0.03125) / 2 = 0.96875 / 2 = 0.484375.
      // So it hits slightly before 0.5.

      expect(trace.fraction).toBeLessThan(0.5);
      expect(trace.fraction).toBeGreaterThan(0.48);
      expect(trace.plane?.normal.x).toBe(1);
    });
  });
});
