import { Draw_Hud } from '../src/hud.js';
import { Draw_Number } from '../src/hud/numbers.js';
import { HUD_LAYOUT } from '../src/hud/layout.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Renderer } from '@quake2ts/engine';

// Mock the numbers module to isolate the Draw_Hud logic
vi.mock('../src/hud/numbers.js', () => ({
    Draw_Number: vi.fn(),
}));

describe('HUD', () => {
    let mockRenderer: Renderer;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRenderer = {
            renderFrame: vi.fn(),
            registerPic: vi.fn(),
            drawPic: vi.fn(),
            drawString: vi.fn(),
        };
    });

    it('should draw the status bar', () => {
        Draw_Hud(mockRenderer, 100, 50, 30);

        expect(Draw_Number).toHaveBeenCalledWith(
            mockRenderer,
            HUD_LAYOUT.HEALTH_X,
            HUD_LAYOUT.HEALTH_Y,
            100,
            expect.any(Array),
            expect.any(Number)
        );
        expect(Draw_Number).toHaveBeenCalledWith(
            mockRenderer,
            HUD_LAYOUT.ARMOR_X,
            HUD_LAYOUT.ARMOR_Y,
            50,
            expect.any(Array),
            expect.any(Number)
        );
        expect(Draw_Number).toHaveBeenCalledWith(
            mockRenderer,
            HUD_LAYOUT.AMMO_X,
            HUD_LAYOUT.AMMO_Y,
            30,
            expect.any(Array),
            expect.any(Number)
        );
    });
});
