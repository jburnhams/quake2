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
        // Explicitly set mock implementations again to ensure they persist
        (mockRenderer.registerTexture as any).mockImplementation((name: string) => ({ width: 16, height: 16, name }));
        (mockRenderer.registerPic as any).mockResolvedValue({ width: 16, height: 16, name: 'mock' });
        (mockAssetManager.loadTexture as any).mockResolvedValue({ width: 16, height: 16, levels: [], source: 'pcx' });
    });

    it('should initialize and draw default crosshair', async () => {
        await Init_Crosshair(mockRenderer, mockAssetManager);

        Draw_Crosshair(mockRenderer, 640, 480);

        expect(mockAssetManager.loadTexture).toHaveBeenCalled();
        expect(mockRenderer.registerTexture).toHaveBeenCalled();

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
