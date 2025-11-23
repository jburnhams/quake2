import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Draw_Damage, Init_Damage } from '../src/hud/damage.js';
import { Renderer, Pic, AssetManager, PreparedTexture } from '@quake2ts/engine';
import { PlayerState } from '@quake2ts/shared';

const mockRenderer = {
    drawPic: vi.fn(),
    registerPic: vi.fn().mockImplementation((name) => Promise.resolve({ width: 32, height: 32, name } as any)),
    registerTexture: vi.fn().mockImplementation((name) => ({ width: 32, height: 32, name } as any)),
    width: 640,
    height: 480
} as unknown as Renderer;

const mockAssetManager = {
    loadTexture: vi.fn().mockResolvedValue({ width: 32, height: 32, levels: [], source: 'pcx' } as PreparedTexture)
} as unknown as AssetManager;

describe('Damage Indicators', () => {
    let ps: PlayerState;

    beforeEach(async () => {
        vi.clearAllMocks();
        await Init_Damage(mockRenderer, mockAssetManager);

        ps = {
            damageAlpha: 0,
            damageIndicators: [],
            origin: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            viewAngles: { x: 0, y: 0, z: 0 },
            onGround: true,
            waterLevel: 0,
            mins: { x: 0, y: 0, z: 0 },
            maxs: { x: 0, y: 0, z: 0 },
        } as unknown as PlayerState;
    });

    it('should draw indicator when damaged from right', () => {
        ps.viewAngles = { x: 0, y: 90, z: 0 };
        ps.damageIndicators = [{
            direction: { x: 1, y: 0, z: 0 }, // From East
            strength: 10
        }];

        Draw_Damage(mockRenderer, ps);

        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            608, 224, // 608, (480-32)/2
            expect.objectContaining({ name: 'd_right' })
        );
    });

    it('should draw indicator when damaged from left', () => {
        ps.viewAngles = { x: 0, y: 90, z: 0 };
        ps.damageIndicators = [{
            direction: { x: -1, y: 0, z: 0 },
            strength: 10
        }];

        Draw_Damage(mockRenderer, ps);

        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            0, 224,
            expect.objectContaining({ name: 'd_left' })
        );
    });

    it('should draw indicator when damaged from front', () => {
        ps.viewAngles = { x: 0, y: 90, z: 0 };
        ps.damageIndicators = [{
            direction: { x: 0, y: 1, z: 0 },
            strength: 10
        }];

        Draw_Damage(mockRenderer, ps);

        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            304, 0,
            expect.objectContaining({ name: 'd_up' })
        );
    });
});
