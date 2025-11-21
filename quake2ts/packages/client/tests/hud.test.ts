import { describe, it, expect, vi } from 'vitest';
import { Draw_Hud, Init_Hud } from '../src/hud';
import { PakArchive, Pic, Renderer } from '@quake2ts/engine';
import { PlayerClient, WeaponId, PowerupId } from '@quake2ts/game';
import { HUD_LAYOUT } from '../src/hud/layout';

import { PlayerState, angleVectors, dotVec3 } from '@quake2ts/shared';

describe('HUD', () => {
    it('should draw all HUD elements correctly', async () => {
        const mockRenderer = {
            width: 800,
            height: 600,
            gl: { canvas: { width: 800, height: 600 } },
            registerPic: vi.fn(async (name: string, buffer: ArrayBuffer) => ({
                width: 24,
                height: 24,
                name,
            })),
            drawPic: vi.fn(),
            begin2D: vi.fn(),
            end2D: vi.fn(),
            drawfillRect: vi.fn(),
            drawString: vi.fn(),
        } as unknown as Renderer;

        const mockPak = {
            readFile: vi.fn(() => ({ buffer: new ArrayBuffer(0) })),
        } as unknown as PakArchive;

        const mockClient = {
            inventory: {
                currentWeapon: WeaponId.Shotgun,
                powerups: new Map<PowerupId, number | null>([
                    [PowerupId.QuadDamage, 10],
                    [PowerupId.Invulnerability, 5],
                ]),
            },
        } as unknown as PlayerClient;

        const mockPlayerState = {
            damageAlpha: 0.5,
            damageIndicators: [{ direction: { x: 0, y: 1, z: 0 }, strength: 1 }],
            viewAngles: { x: 0, y: 90, z: 0 },
        } as unknown as PlayerState;

        const mockStats = {
            fps: 60,
            drawCalls: 100,
            batches: 10,
            facesDrawn: 1000,
            vertexCount: 50000,
        } as FrameRenderStats;

        await Init_Hud(mockRenderer, mockPak);
        Draw_Hud(mockRenderer, mockPlayerState, mockClient, 100, 50, 25, mockStats);

        // Verify damage flash
        expect(mockRenderer.drawfillRect).toHaveBeenCalledWith(0, 0, 800, 600, [1, 0, 0, 0.5]);

        // Verify diagnostics
        expect(mockRenderer.drawString).toHaveBeenCalledWith(10, 10, 'FPS: 60');
        expect(mockRenderer.drawString).toHaveBeenCalledWith(10, 20, 'Draw Calls: 100');
        expect(mockRenderer.drawString).toHaveBeenCalledWith(10, 30, 'Batches: 10');
        expect(mockRenderer.drawString).toHaveBeenCalledWith(10, 40, 'Faces Drawn: 1000');
        expect(mockRenderer.drawString).toHaveBeenCalledWith(10, 50, 'Vertices: 50000');
        
        // Verify crosshair
        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            (800 - 24) / 2, 
            (600 - 24) / 2, 
            expect.objectContaining({ name: 'crosshair' })
        );

        // Verify weapon icon
        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            HUD_LAYOUT.WEAPON_ICON_X, 
            HUD_LAYOUT.WEAPON_ICON_Y, 
            expect.objectContaining({ name: 'w_shotgun' })
        );

        // Verify powerup icons
        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            HUD_LAYOUT.POWERUP_X, 
            HUD_LAYOUT.POWERUP_Y, 
            expect.objectContaining({ name: 'p_quad' })
        );
        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            HUD_LAYOUT.POWERUP_X - 28, // 24 width + 4 padding 
            HUD_LAYOUT.POWERUP_Y, 
            expect.objectContaining({ name: 'p_invulnerability' })
        );

        // Verify damage indicators
        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            0,
            (600 - 24) / 2,
            expect.objectContaining({ name: 'd_left' })
        );
    });
});
