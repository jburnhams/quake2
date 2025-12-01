import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Draw_Icons, iconPics } from '../../src/hud/icons.js';
import { Renderer, Pic } from '@quake2ts/engine';
import { PlayerClient, WeaponId, KeyId, ArmorType } from '@quake2ts/game';

describe('HUD Icons', () => {
    let mockRenderer: Renderer;
    let mockPic: Pic;

    beforeEach(() => {
        mockRenderer = {
            width: 640,
            height: 480,
            drawString: vi.fn(),
            drawPic: vi.fn(),
            renderFrame: vi.fn(),
            registerPic: vi.fn(),
            begin2D: vi.fn(),
            end2D: vi.fn(),
            drawfillRect: vi.fn(),
        };

        mockPic = {
            width: 32,
            height: 32,
            bind: vi.fn(),
            upload: vi.fn(),
            destroy: vi.fn(),
        } as unknown as Pic;

        iconPics.clear();
    });

    it('should draw armor icon', () => {
        const client = {
            inventory: {
                armor: { armorType: ArmorType.JACKET, armorCount: 50 },
                currentWeapon: undefined,
                powerups: new Map(),
                keys: new Set(),
            }
        } as unknown as PlayerClient;

        iconPics.set('i_jacketarmor', mockPic);

        Draw_Icons(mockRenderer, client, [], 0, 1000);

        expect(mockRenderer.drawPic).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), mockPic);
    });

    it('should draw key icons', () => {
        const client = {
            inventory: {
                armor: null,
                currentWeapon: undefined,
                powerups: new Map(),
                keys: new Set([KeyId.Blue, KeyId.Red]),
            }
        } as unknown as PlayerClient;

        iconPics.set('k_bluekey', mockPic);
        iconPics.set('k_redkey', mockPic);

        Draw_Icons(mockRenderer, client, [], 0, 1000);

        expect(mockRenderer.drawPic).toHaveBeenCalledTimes(2);
    });
});
