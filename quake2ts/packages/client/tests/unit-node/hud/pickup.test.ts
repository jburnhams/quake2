import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Draw_Pickup } from '@quake2ts/client/hud/pickup.js';
import { Renderer, Pic } from '@quake2ts/engine';
import { PlayerState } from '@quake2ts/shared';
import { iconPics } from '@quake2ts/client/hud/icons.js';

describe('Draw_Pickup', () => {
    beforeEach(() => {
        iconPics.clear();
    });

    it('should draw pickup icon if present and loaded', () => {
        const renderer = {
            width: 640,
            height: 480,
            drawPic: vi.fn(),
        } as unknown as Renderer;

        const icon = { width: 32, height: 32 } as Pic;
        iconPics.set('w_railgun', icon);

        const ps = {
            pickupIcon: 'w_railgun',
        } as unknown as PlayerState;

        Draw_Pickup(renderer, ps);

        const expectedX = 640 - 32 - 10;
        const expectedY = 480 - 32 - 10;
        expect(renderer.drawPic).toHaveBeenCalledWith(expectedX, expectedY, icon);
    });

    it('should not draw if pickupIcon is missing', () => {
        const renderer = {
            drawPic: vi.fn(),
        } as unknown as Renderer;

        const ps = {
            pickupIcon: undefined,
        } as unknown as PlayerState;

        Draw_Pickup(renderer, ps);

        expect(renderer.drawPic).not.toHaveBeenCalled();
    });

    it('should not draw if icon is not loaded', () => {
        const renderer = {
            drawPic: vi.fn(),
        } as unknown as Renderer;

        const ps = {
            pickupIcon: 'w_missing',
        } as unknown as PlayerState;

        Draw_Pickup(renderer, ps);

        expect(renderer.drawPic).not.toHaveBeenCalled();
    });
});
