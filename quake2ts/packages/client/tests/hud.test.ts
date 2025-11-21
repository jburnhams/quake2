import { Draw_Hud } from '../src/hud.js';
import { Draw_Number } from '../src/hud/numbers.js';
import { HUD_LAYOUT } from '../src/hud/layout.js';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../src/hud/numbers.js', () => ({
    Draw_Number: vi.fn(),
}));

describe('HUD', () => {
    it('should draw the status bar', () => {
        Draw_Hud(100, 50, 30);

        expect(Draw_Number).toHaveBeenCalledWith(
            HUD_LAYOUT.HEALTH_X,
            HUD_LAYOUT.HEALTH_Y,
            100,
            expect.any(Array),
            expect.any(Number)
        );
        expect(Draw_Number).toHaveBeenCalledWith(
            HUD_LAYOUT.ARMOR_X,
            HUD_LAYOUT.ARMOR_Y,
            50,
            expect.any(Array),
            expect.any(Number)
        );
        expect(Draw_Number).toHaveBeenCalledWith(
            HUD_LAYOUT.AMMO_X,
            HUD_LAYOUT.AMMO_Y,
            30,
            expect.any(Array),
            expect.any(Number)
        );
    });
});
