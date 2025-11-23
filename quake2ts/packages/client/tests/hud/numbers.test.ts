import { Draw_Number } from '../../src/hud/numbers.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Renderer } from '@quake2ts/engine';

describe('Draw_Number', () => {
    let mockRenderer: Renderer;

    beforeEach(() => {
        mockRenderer = {
            renderFrame: vi.fn(),
            registerPic: vi.fn(),
            begin2D: vi.fn(),
            end2D: vi.fn(),
            drawPic: vi.fn(),
            drawString: vi.fn(),
        };
    });

    it('should draw a multi-digit number', () => {
        const pics = [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}] as any[];
        Draw_Number(mockRenderer, 10, 20, 123, pics, 10);

        expect(mockRenderer.drawPic).toHaveBeenCalledTimes(3);
        expect(mockRenderer.drawPic).toHaveBeenCalledWith(10, 20, pics[1], undefined);
        expect(mockRenderer.drawPic).toHaveBeenCalledWith(20, 20, pics[2], undefined);
        expect(mockRenderer.drawPic).toHaveBeenCalledWith(30, 20, pics[3], undefined);
    });
});
