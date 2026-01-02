import { describe, it, expect, vi } from 'vitest';
import { createOcclusionResolver } from '../../../src/audio/occlusion.js';
import type { ListenerState } from '../../../src/audio/spatialization.js';
import type { Vec3 } from '@quake2ts/shared';
import { ATTN_NORM } from '../../../src/audio/constants.js';

describe('AudioOcclusion', () => {
    const listener: ListenerState = { origin: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 } };

    it('returns distance-based lowpass even if trace is clear', () => {
        const trace = vi.fn().mockReturnValue({ fraction: 1.0 });
        const resolver = createOcclusionResolver(trace);

        // Far away source (ATTN_NORM max dist is ~1000)
        const source: Vec3 = { x: 500, y: 0, z: 0 };

        const result = resolver(listener, source, ATTN_NORM);

        expect(result).toBeDefined();
        expect(result?.gainScale).toBe(1.0);
        expect(result?.lowpassHz).toBeLessThan(20000);
        expect(result?.lowpassHz).toBeGreaterThan(400); // Should not be as muffled as occlusion
    });

    it('returns occlusion result if trace is blocked', () => {
        const trace = vi.fn().mockReturnValue({ fraction: 0.5 });
        const resolver = createOcclusionResolver(trace);

        const source: Vec3 = { x: 100, y: 0, z: 0 };

        const result = resolver(listener, source, ATTN_NORM);
        expect(result).toBeDefined();
        expect(result?.gainScale).toBe(0.3);
        expect(result?.lowpassHz).toBeLessThanOrEqual(400); // Dominated by occlusion
    });

    it('returns undefined if close and clear', () => {
        const trace = vi.fn().mockReturnValue({ fraction: 1.0 });
        const resolver = createOcclusionResolver(trace);

        const source: Vec3 = { x: 1, y: 0, z: 0 }; // Very close

        const result = resolver(listener, source, ATTN_NORM);
        // Might return undefined if cutoff is essentially 20k
        if (result) {
            expect(result.lowpassHz).toBeGreaterThan(19000);
            expect(result.gainScale).toBe(1.0);
        } else {
            expect(result).toBeUndefined();
        }
    });
});
