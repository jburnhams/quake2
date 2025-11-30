import { describe, it, expect } from 'vitest';
import {
    clipBoxToBrush,
    createDefaultTrace,
    testBoxInBrush,
    type CollisionBrush,
    type CollisionPlane,
    type TraceResult
} from '../../src/bsp/collision.js';
import { type Vec3 } from '../../src/math/vec3.js';

describe('Trace System Verification', () => {

    // Helper to create a simple brush (axis-aligned box)
    function createBoxBrush(mins: Vec3, maxs: Vec3, contents: number): CollisionBrush {
        const planes: CollisionPlane[] = [
            { normal: { x: 1, y: 0, z: 0 }, dist: maxs.x, type: 0, signbits: 0 },
            { normal: { x: -1, y: 0, z: 0 }, dist: -mins.x, type: 0, signbits: 1 },
            { normal: { x: 0, y: 1, z: 0 }, dist: maxs.y, type: 1, signbits: 0 },
            { normal: { x: 0, y: -1, z: 0 }, dist: -mins.y, type: 1, signbits: 2 },
            { normal: { x: 0, y: 0, z: 1 }, dist: maxs.z, type: 2, signbits: 0 },
            { normal: { x: 0, y: 0, z: -1 }, dist: -mins.z, type: 2, signbits: 4 },
        ];

        return {
            contents,
            sides: planes.map(p => ({ plane: p, surfaceFlags: 0 })),
            checkcount: 0
        };
    }

    describe('CM_ClipBoxToBrush (clipBoxToBrush)', () => {
        it('should correctly offset plane distances for signed bbox', () => {
            const brush = createBoxBrush({ x: -10, y: -10, z: -10 }, { x: 10, y: 10, z: 10 }, 1);
            const mins = { x: -1, y: -1, z: -1 };
            const maxs = { x: 1, y: 1, z: 1 };
            const start = { x: -20, y: 0, z: 0 };
            const end = { x: 20, y: 0, z: 0 };

            const trace = createDefaultTrace();
            clipBoxToBrush({ start, end, mins, maxs, brush, trace });

            expect(trace.fraction).toBeLessThan(1);
            expect(trace.fraction).toBeCloseTo(0.225);
            expect(trace.plane?.normal.x).toBe(-1);
        });

        it('should handle startsolid correctly (exiting brush)', () => {
            const brush = createBoxBrush({ x: -10, y: -10, z: -10 }, { x: 10, y: 10, z: 10 }, 1);
            const start = { x: 0, y: 0, z: 0 };
            const end = { x: 20, y: 0, z: 0 };
            const mins = { x: -1, y: -1, z: -1 };
            const maxs = { x: 1, y: 1, z: 1 };

            const trace = createDefaultTrace();
            clipBoxToBrush({ start, end, mins, maxs, brush, trace });

            expect(trace.startsolid).toBe(true);
            expect(trace.allsolid).toBe(false);
            expect(trace.fraction).toBe(0);
        });

        it('should handle allsolid correctly (staying inside)', () => {
           const brush = createBoxBrush({ x: -10, y: -10, z: -10 }, { x: 10, y: 10, z: 10 }, 1);
           const start = { x: 0, y: 0, z: 0 };
           const end = { x: 5, y: 0, z: 0 };
           const mins = { x: -1, y: -1, z: -1 };
           const maxs = { x: 1, y: 1, z: 1 };

           const trace = createDefaultTrace();
           clipBoxToBrush({ start, end, mins, maxs, brush, trace });

           expect(trace.startsolid).toBe(true);
           expect(trace.allsolid).toBe(true);
           expect(trace.fraction).toBe(0);
       });

         it('should handle grazing edges', () => {
            const brush = createBoxBrush({ x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 }, 1);
            const mins = { x: 0, y: 0, z: 0 };
            const maxs = { x: 10, y: 10, z: 10 };
            const start = { x: -20, y: 5, z: 10.01 };
            const end = { x: 20, y: 5, z: 10.01 };

            const trace = createDefaultTrace();
            clipBoxToBrush({ start, end, mins, maxs, brush, trace });

            expect(trace.startsolid).toBe(false);
            expect(trace.fraction).toBe(1);
         });
    });

    describe('CM_TestBoxInBrush (testBoxInBrush)', () => {
        it('should detect startsolid inside brush', () => {
            const brush = createBoxBrush({ x: -10, y: -10, z: -10 }, { x: 10, y: 10, z: 10 }, 1);
            const origin = { x: 0, y: 0, z: 0 };
            const mins = { x: -1, y: -1, z: -1 };
            const maxs = { x: 1, y: 1, z: 1 };

            const result = testBoxInBrush(origin, mins, maxs, brush);
            expect(result.startsolid).toBe(true);
            expect(result.allsolid).toBe(true);
        });

        it('should return false if outside', () => {
             const brush = createBoxBrush({ x: -10, y: -10, z: -10 }, { x: 10, y: 10, z: 10 }, 1);
            const origin = { x: 20, y: 0, z: 0 };
            const mins = { x: -1, y: -1, z: -1 };
            const maxs = { x: 1, y: 1, z: 1 };

            const result = testBoxInBrush(origin, mins, maxs, brush);
            expect(result.startsolid).toBe(false);
        });
    });

});
