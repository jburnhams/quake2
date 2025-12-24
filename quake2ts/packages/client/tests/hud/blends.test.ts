import { describe, it, expect, vi } from 'vitest';
import { createMockRenderer } from '@quake2ts/test-utils';
import { Draw_Blends } from '../../src/hud/blends.js';
import { PlayerState } from '@quake2ts/shared';

describe('Draw_Blends', () => {
    it('should draw a fullscreen rect when alpha > 0', () => {
        const renderer = createMockRenderer({
            width: 640,
            height: 480,
            drawfillRect: vi.fn(),
        });

        const ps = {
            blend: [1, 0, 0, 0.5],
        } as unknown as PlayerState;

        Draw_Blends(renderer, ps);

        expect(renderer.drawfillRect).toHaveBeenCalledWith(0, 0, 640, 480, [1, 0, 0, 0.5]);
    });

    it('should not draw when alpha is 0', () => {
        const renderer = createMockRenderer({
            width: 640,
            height: 480,
            drawfillRect: vi.fn(),
        });

        const ps = {
            blend: [1, 0, 0, 0],
        } as unknown as PlayerState;

        Draw_Blends(renderer, ps);

        expect(renderer.drawfillRect).not.toHaveBeenCalled();
    });

    it('should not draw when blend is missing', () => {
        const renderer = createMockRenderer({
            width: 640,
            height: 480,
            drawfillRect: vi.fn(),
        });

        const ps = {
        } as unknown as PlayerState;

        Draw_Blends(renderer, ps);

        expect(renderer.drawfillRect).not.toHaveBeenCalled();
    });
});
