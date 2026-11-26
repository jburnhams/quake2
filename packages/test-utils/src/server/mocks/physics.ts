import { vi } from 'vitest';
import { TraceResult } from '@quake2ts/shared';

/**
 * Mock interface for CollisionEntityIndex.
 */
export interface MockCollisionEntityIndex {
    trace: (start: any, mins: any, maxs: any, end: any, passEntity: any, contentMask: number) => TraceResult;
    link: (entity: any) => void;
    unlink: (entity: any) => void;
    gatherTriggerTouches: (entity: any) => any[];
}

/**
 * Creates a mock CollisionEntityIndex.
 * @param overrides Optional overrides for the mock methods.
 */
export function createMockCollisionEntityIndex(overrides?: Partial<MockCollisionEntityIndex>): MockCollisionEntityIndex {
    return {
        trace: vi.fn().mockReturnValue({
            fraction: 1.0,
            allsolid: false,
            startsolid: false,
            endpos: { x: 0, y: 0, z: 0 },
            entityId: null
        }),
        link: vi.fn(),
        unlink: vi.fn(),
        gatherTriggerTouches: vi.fn().mockReturnValue([]),
        ...overrides
    };
}
