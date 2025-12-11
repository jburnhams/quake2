import { describe, it, expect } from 'vitest';
import { createBlendState, updateBlend } from '../../src/view/blend.js';
import { PlayerState, PlayerStat } from '@quake2ts/shared';

describe('view/blend', () => {
    it('should initialize with zero state', () => {
        const state = createBlendState();
        expect(state.damageAlpha).toBe(0);
        expect(state.bonusAlpha).toBe(0);
        expect(state.lastFlashes).toBe(0);
    });

    it('should decay damage alpha', () => {
        const state = createBlendState();
        state.damageAlpha = 0.5;
        const ps = { stats: [] } as unknown as PlayerState;

        updateBlend(state, ps, 0.1, 0);
        expect(state.damageAlpha).toBeCloseTo(0.4);

        updateBlend(state, ps, 0.5, 0);
        expect(state.damageAlpha).toBe(0);
    });

    it('should set damage alpha on event', () => {
        const state = createBlendState();
        const ps = { stats: [] } as unknown as PlayerState;

        updateBlend(state, ps, 0.1, 0.5);
        expect(state.damageAlpha).toBe(0.5);
    });

    it('should trigger bonus flash on flashes stat change', () => {
        const state = createBlendState();
        const ps = { stats: [] } as unknown as PlayerState;
        // Mock flashes stat
        // Assuming STAT_FLASHES is used.
        // We can't easily mock the enum key if it's dynamic, but we can assume standard behavior or mock property access if we used proxy.
        // But we just passed ps.stats array.
        // We need to know the index used in blend.ts.
        // In blend.ts: ps.stats[PlayerStat.STAT_FLASHES] ?? 10

        const flashIndex = PlayerStat.STAT_FLASHES ?? 10;
        ps.stats[flashIndex] = 1;

        updateBlend(state, ps, 0.1, 0);

        expect(state.bonusAlpha).toBe(0.6);
        expect(state.lastFlashes).toBe(1);
    });

    it('should prioritize bonus (yellow) over damage (red)', () => {
        const state = createBlendState();
        state.bonusAlpha = 0.5;
        state.damageAlpha = 0.5;
        const ps = { stats: [] } as unknown as PlayerState;

        const blend = updateBlend(state, ps, 0, 0);
        // Yellow: [1, 1, 0, alpha]
        expect(blend[0]).toBe(1);
        expect(blend[1]).toBe(1);
        expect(blend[2]).toBe(0);
        expect(blend[3]).toBeCloseTo(0.5 * 0.3);
    });

    it('should return red for damage only', () => {
        const state = createBlendState();
        state.bonusAlpha = 0;
        state.damageAlpha = 0.5;
        const ps = { stats: [] } as unknown as PlayerState;

        const blend = updateBlend(state, ps, 0, 0);
        // Red: [1, 0, 0, alpha]
        expect(blend[0]).toBe(1);
        expect(blend[1]).toBe(0);
        expect(blend[2]).toBe(0);
        expect(blend[3]).toBeCloseTo(0.5 * 0.5);
    });
});
