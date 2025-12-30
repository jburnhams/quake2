import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Draw_Crosshair, Init_Crosshair, Set_Crosshair, Cycle_Crosshair } from '@quake2ts/client/hud/crosshair.js';
import { Renderer, Pic, AssetManager, PreparedTexture } from '@quake2ts/engine';
import { createMockRenderer, createMockAssetManager } from '@quake2ts/test-utils';

const mockRenderer = createMockRenderer({
    width: 640,
    height: 480,
    registerPic: vi.fn().mockImplementation((name) => Promise.resolve({ width: 16, height: 16, name } as any)),
    registerTexture: vi.fn().mockImplementation((name) => ({ width: 16, height: 16, name } as any)),
    drawPic: vi.fn()
});

// Mock AssetManager using centralized factory from test-utils
const mockAssetManager = createMockAssetManager({
    loadTexture: vi.fn().mockResolvedValue({ width: 16, height: 16, levels: [], source: 'pcx' } as PreparedTexture)
});

describe('Crosshair', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize and draw default crosshair', async () => {
        await Init_Crosshair(mockRenderer, mockAssetManager);

        Draw_Crosshair(mockRenderer, 640, 480);

        expect(mockAssetManager.loadTexture).toHaveBeenCalled();
        expect(mockRenderer.registerTexture).toHaveBeenCalled();

        // The crosshair drawing relies on the pic actually being registered and available.
        // In the original test, it asserted arguments.
        // If drawPic wasn't called, it might be because the crosshair pic wasn't found or loaded in the internal state of crosshair module.
        // Or `crosshair_pic` variable in the module wasn't set.

        // Let's assume Init_Crosshair successfully sets the internal state if mocks work.
        // The mock implementation of registerTexture returns a valid object, so it should work.

        // If it's still failing, we might need to verify if Init_Crosshair waits for loading. It is async.

        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            312, 232, // (640-16)/2, (480-16)/2
            expect.objectContaining({ name: 'ch1' }),
            expect.anything() // Color argument
        );
    });

    it('should cycle crosshairs', async () => {
        await Init_Crosshair(mockRenderer, mockAssetManager);

        Set_Crosshair(0);

        let index = Cycle_Crosshair();
        expect(index).toBe(1);

        index = Cycle_Crosshair();
        expect(index).toBe(2);

        index = Cycle_Crosshair();
        expect(index).toBe(-1); // Disabled state

        index = Cycle_Crosshair();
        expect(index).toBe(0); // Back to first
    });

    it('should draw the selected crosshair', async () => {
        await Init_Crosshair(mockRenderer, mockAssetManager);
        Set_Crosshair(0);

        Draw_Crosshair(mockRenderer, 640, 480);
        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            (640 - 16) / 2,
            (480 - 16) / 2,
            expect.objectContaining({ name: 'ch1' }),
            expect.anything() // Color argument
        );
    });
});
