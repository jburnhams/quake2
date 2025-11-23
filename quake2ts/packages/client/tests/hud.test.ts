import { describe, it, expect, vi } from 'vitest';
import { Draw_Hud, Init_Hud } from '../src/hud';
import { MessageSystem } from '../src/hud/messages';
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
                    [PowerupId.QuadDamage, 2000],
                    [PowerupId.Invulnerability, 3000],
                ]),
                keys: new Set(),
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

        const mockMessageSystem = new MessageSystem();
        vi.spyOn(mockMessageSystem, 'drawCenterPrint');
        vi.spyOn(mockMessageSystem, 'drawNotifications');

        await Init_Hud(mockRenderer, mockPak);
        Draw_Hud(mockRenderer, mockPlayerState, mockClient, 100, 50, 25, mockStats, mockMessageSystem, 1000);

        // Verify message system called
        expect(mockMessageSystem.drawCenterPrint).toHaveBeenCalledWith(mockRenderer, 1000);
        expect(mockMessageSystem.drawNotifications).toHaveBeenCalledWith(mockRenderer, 1000);

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
        // Width of icon (24) + Width of number "1" (24) + padding (8) = 56
        // 610 - 56 = 554
        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            HUD_LAYOUT.POWERUP_X - 56,
            HUD_LAYOUT.POWERUP_Y, 
            expect.objectContaining({ name: 'p_invulnerability' })
        );

        // Verify damage indicators
        // Damage from {x:0, y:1, z:0} with player facing yaw=90 (east)
        // means damage comes from straight ahead, so should show d_up (forward indicator)
        expect(mockRenderer.drawPic).toHaveBeenCalledWith(
            (800 - 24) / 2,
            0,
            expect.objectContaining({ name: 'd_up' })
        );
    });
});
