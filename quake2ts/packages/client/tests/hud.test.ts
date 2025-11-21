
import { vi, describe, it, expect } from 'vitest';
import { Draw_Hud } from '../src/hud.js';
import { Draw_String } from '../../engine/src/render/draw.js';

vi.mock('../../engine/src/render/draw.js', () => ({
    Draw_String: vi.fn(),
}));

describe('HUD', () => {
    it('should call Draw_String', () => {
        Draw_Hud();
        expect(Draw_String).toHaveBeenCalledWith(10, 10, 'HUD placeholder');
    });
});
