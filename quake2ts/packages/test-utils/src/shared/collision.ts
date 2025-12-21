import type { Vec3 } from '@quake2ts/shared/math/vec3';
import type { TraceResult, CollisionPlane } from '@quake2ts/shared/bsp/collision';

// Re-export trace helpers from shared if they exist there now, or redefine them here if needed
// The plan says "Move trace helpers from game/helpers.ts to shared/collision.ts"
// But currently `game/helpers.ts` re-exports them from `@quake2ts/shared`.
// `intersects`, `stairTrace`, `ladderTrace` are in `packages/shared/src/testing.ts`.
// I will re-export them here for test-utils consumers.

export { intersects, stairTrace, ladderTrace } from '@quake2ts/shared';

/**
 * Interface for a TraceResult mock, including all standard properties.
 */
export interface TraceMock extends Partial<TraceResult> {
    fraction: number;
    endpos: Vec3;
    plane: CollisionPlane;
    surface: { flags: number, name?: string, value?: number };
    contents: number;
    ent: any; // Using any to avoid circular dependency with Entity
    allsolid: boolean;
    startsolid: boolean;
}

/**
 * Creates a mock TraceResult.
 *
 * @param overrides - Optional overrides for trace properties.
 * @returns A TraceMock object.
 */
export const createTraceMock = (overrides?: Partial<TraceMock>): TraceMock => ({
    fraction: 1.0,
    endpos: { x: 0, y: 0, z: 0 },
    plane: { normal: { x: 0, y: 0, z: 0 }, dist: 0, type: 0, signbits: 0 },
    surface: { flags: 0 },
    contents: 0,
    ent: null,
    allsolid: false,
    startsolid: false,
    ...overrides
});

/**
 * Interface for a Surface mock.
 */
export interface SurfaceMock {
    flags: number;
    name: string;
    value: number;
}

/**
 * Creates a mock Surface.
 *
 * @param overrides - Optional overrides for surface properties.
 * @returns A SurfaceMock object.
 */
export const createSurfaceMock = (overrides?: Partial<SurfaceMock>): SurfaceMock => ({
    flags: 0,
    name: 'default',
    value: 0,
    ...overrides
});
