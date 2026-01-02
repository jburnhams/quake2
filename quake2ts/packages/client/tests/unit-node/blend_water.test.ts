
import { describe, it, expect } from 'vitest';
import { updateBlend, createBlendState, BlendState } from '@quake2ts/client/blend.js';
import { PlayerState, PlayerStat, CONTENTS_WATER } from '@quake2ts/shared';

describe('updateBlend', () => {
    it('should return water tint when waterLevel >= 3', () => {
        const state: BlendState = createBlendState();
        const ps: PlayerState = {
            waterLevel: 3,
            stats: [],
            pmFlags: 0,
            origin: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            viewAngles: { x: 0, y: 0, z: 0 },
            // ... other mandatory fields mock
        } as unknown as PlayerState;

        const blend = updateBlend(state, ps, 0.1);

        // Expect tint [0.5, 0.3, 0.2, 0.4]
        expect(blend).toEqual([0.5, 0.3, 0.2, 0.4]);
    });

    it('should return zero blend when not underwater', () => {
        const state: BlendState = createBlendState();
        const ps: PlayerState = {
            waterLevel: 0,
            stats: [],
            pmFlags: 0
        } as unknown as PlayerState;

        const blend = updateBlend(state, ps, 0.1);
        expect(blend).toEqual([0, 0, 0, 0]);
    });
});
