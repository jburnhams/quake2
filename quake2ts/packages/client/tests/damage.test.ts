import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Draw_Damage, Init_Damage } from '../src/hud/damage.js';
import { Renderer, Pic, PakArchive } from '@quake2ts/engine';
import { PlayerState } from '@quake2ts/shared';

const mockRenderer = {
    drawPic: vi.fn(),
    registerPic: vi.fn().mockImplementation((name) => Promise.resolve({ width: 32, height: 32, name } as any)),
    width: 640,
    height: 480
} as unknown as Renderer;

const mockPak = {
    readFile: vi.fn().mockReturnValue({ buffer: new ArrayBuffer(0) })
} as unknown as PakArchive;

describe('Damage Indicators', () => {
    let ps: PlayerState;

    beforeEach(async () => {
        vi.clearAllMocks();
        await Init_Damage(mockRenderer, mockPak);

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
        // Player facing North (0, 90, 0)? Quake angles: Pitch, Yaw, Roll.
        // Yaw 0 is East. Yaw 90 is North.
        // Let's assume viewAngles { x: 0, y: 90, z: 0 }.
        // Damage from East (1, 0, 0).
        // Relative to North facing player, East is Right.

        ps.viewAngles = { x: 0, y: 90, z: 0 };
        ps.damageIndicators = [{
            direction: { x: 1, y: 0, z: 0 }, // From East
            strength: 10
        }];

        Draw_Damage(mockRenderer, ps);

        // Should draw 'd_right'
        // d_right should be at right side of screen.
        // x = 640 - 32 = 608.

        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            608, 224, // 608, (480-32)/2
            expect.objectContaining({ name: 'd_right' })
        );
    });

    it('should draw indicator when damaged from left', () => {
        // Player facing North (90).
        // Damage from West (-1, 0, 0).
        // Relative to North facing player, West is Left.

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
        // Player facing North (90).
        // Damage from North (0, 1, 0).

        ps.viewAngles = { x: 0, y: 90, z: 0 };
        ps.damageIndicators = [{
            direction: { x: 0, y: 1, z: 0 },
            strength: 10
        }];

        Draw_Damage(mockRenderer, ps);

        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            304, 0,
            expect.objectContaining({ name: 'd_up' }) // Front is "up" on screen usually? Or maybe I have my mapping wrong.
            // Let's check logic in Draw_Damage.
            // angle > 45 && angle <= 135 -> d_up.
            // rightDot, forwardDot.
            // forward for 90 deg yaw is (0,1,0). right is (1,0,0).
            // damage (0,1,0).
            // forwardDot = 1. rightDot = 0.
            // atan2(1, 0) = 90 degrees.
            // 90 is > 45 and <= 135. So d_up.
            // Yes.
        );
    });
});
