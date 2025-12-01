import { describe, it, expect, vi } from 'vitest';
import { applyWeaponKick } from '../src/view-effects.js';
import { ViewEffects } from '@quake2ts/cgame';

describe('View Kick Effects', () => {
    it('should apply weapon kick with correct duration and origin', () => {
        const view = new ViewEffects();
        const addKickSpy = vi.spyOn(view, 'addKick');

        applyWeaponKick(view, false);

        expect(addKickSpy).toHaveBeenCalledWith(expect.objectContaining({
            pitch: -2,
            roll: 0,
            durationMs: 200,
            origin: expect.objectContaining({ x: -2, y: 0, z: 0 })
        }));
    });

    it('should scale kick with quad damage', () => {
        const view = new ViewEffects();
        const addKickSpy = vi.spyOn(view, 'addKick');

        applyWeaponKick(view, true);

        expect(addKickSpy).toHaveBeenCalledWith(expect.objectContaining({
            pitch: -8, // -2 * 4
            roll: 0,
            durationMs: 200,
            origin: expect.objectContaining({ x: -2, y: 0, z: 0 }) // Origin kick not scaled
        }));
    });
});
