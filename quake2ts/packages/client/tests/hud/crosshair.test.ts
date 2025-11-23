import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Cycle_Crosshair, Init_Crosshair, Draw_Crosshair, Set_Crosshair } from '../../src/hud/crosshair.js';
import { Renderer, PakArchive, Pic } from '@quake2ts/engine';

describe('Crosshair', () => {
    let renderer: Renderer;
    let pak: PakArchive;

    beforeEach(() => {
        renderer = {
            registerPic: vi.fn().mockResolvedValue({ width: 16, height: 16 } as Pic),
            drawPic: vi.fn(),
        } as unknown as Renderer;
        pak = {
            readFile: vi.fn().mockReturnValue({ buffer: new ArrayBuffer(0) }),
        } as unknown as PakArchive;
        // Reset module state? Hard to do with globals.
        // We rely on Init_Crosshair to reset.
    });

    it('should cycle crosshairs', async () => {
        await Init_Crosshair(renderer, pak);

        Set_Crosshair(0);

        // Initial index 0
        expect(renderer.registerPic).toHaveBeenCalled();

        let index = Cycle_Crosshair();
        expect(index).toBe(1);

        index = Cycle_Crosshair();
        expect(index).toBe(2);

        index = Cycle_Crosshair();
        expect(index).toBe(0);
    });

    it('should draw the selected crosshair', async () => {
        const mockPic = { width: 16, height: 16 } as Pic;
        (renderer.registerPic as any).mockResolvedValue(mockPic);

        await Init_Crosshair(renderer, pak);
        Set_Crosshair(0);

        Draw_Crosshair(renderer, 640, 480);
        expect(renderer.drawPic).toHaveBeenCalledWith(
            (640 - 16) / 2,
            (480 - 16) / 2,
            mockPic
        );
    });
});
