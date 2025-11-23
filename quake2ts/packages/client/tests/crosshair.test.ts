import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Draw_Crosshair, Init_Crosshair, Set_Crosshair } from '../src/hud/crosshair.js';
import { Renderer, Pic, PakArchive } from '@quake2ts/engine';

const mockRenderer = {
    drawPic: vi.fn(),
    registerPic: vi.fn().mockImplementation((name) => Promise.resolve({ width: 16, height: 16, name } as any)),
    width: 640,
    height: 480
} as unknown as Renderer;

const mockPak = {
    readFile: vi.fn().mockReturnValue({ buffer: new ArrayBuffer(0) })
} as unknown as PakArchive;

describe('Crosshair', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize and draw default crosshair', async () => {
        await Init_Crosshair(mockRenderer, mockPak);

        Draw_Crosshair(mockRenderer, 640, 480);

        expect(mockRenderer.registerPic).toHaveBeenCalled();
        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            312, 232, // (640-16)/2, (480-16)/2
            expect.objectContaining({ name: 'ch1' })
        );
    });

    it('should switch crosshairs', async () => {
        await Init_Crosshair(mockRenderer, mockPak);

        Set_Crosshair(1); // ch2
        Draw_Crosshair(mockRenderer, 640, 480);

        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            expect.any(Number), expect.any(Number),
            expect.objectContaining({ name: 'ch2' })
        );
    });
});
