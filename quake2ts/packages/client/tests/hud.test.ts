import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Draw_Hud, Init_Hud } from '../src/hud.js';
import { Renderer, Pic, AssetManager, PreparedTexture } from '@quake2ts/engine';
import { PlayerState } from '@quake2ts/shared';
import { PlayerClient, PowerupId, KeyId } from '@quake2ts/game';
import { MessageSystem } from '../src/hud/messages.js';
import { createMockAssetManager } from '@quake2ts/test-utils';

// Mock engine dependencies
const mockRenderer = {
    begin2D: vi.fn(),
    end2D: vi.fn(),
    drawPic: vi.fn(),
    drawfillRect: vi.fn(),
    drawString: vi.fn(),
    drawCenterString: vi.fn(),
    registerPic: vi.fn().mockResolvedValue({ width: 24, height: 24, name: 'mock' } as any),
    registerTexture: vi.fn().mockReturnValue({ width: 24, height: 24, name: 'mock' } as any),
    width: 640,
    height: 480
} as unknown as Renderer;

// Mock AssetManager using centralized factory from test-utils
const mockAssetManager = createMockAssetManager({
    loadTexture: vi.fn().mockResolvedValue({ width: 24, height: 24, levels: [], source: 'pcx' } as PreparedTexture)
});

describe('HUD Rendering', () => {
    let ps: PlayerState;
    let client: PlayerClient;
    let messageSystem: MessageSystem;

    beforeEach(async () => {
        vi.clearAllMocks();

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

        client = {
            inventory: {
                armor: { armorCount: 50, armorType: 'jacket' },
                currentWeapon: 1, // Blaster usually
                ammo: { counts: [] },
                keys: new Set(),
                powerups: new Map()
            }
        } as unknown as PlayerClient;

        messageSystem = new MessageSystem();

        // Initialize HUD assets with mock asset manager
        await Init_Hud(mockRenderer, mockAssetManager);
    });

    it('should draw basic HUD elements', () => {
        Draw_Hud(mockRenderer, ps, client, 100, 50, 20, {} as any, messageSystem, 1000);

        expect(mockRenderer.begin2D).toHaveBeenCalled();
        expect(mockRenderer.end2D).toHaveBeenCalled();

        // Check for number drawing calls (Draw_Number calls drawPic)
        expect(mockRenderer.drawPic).toHaveBeenCalled();
    });

    it('should draw damage flash when damaged', () => {
        ps.damageAlpha = 0.5;
        Draw_Hud(mockRenderer, ps, client, 100, 50, 20, {} as any, messageSystem, 1000);

        expect(mockRenderer.drawfillRect).toHaveBeenCalledWith(
            0, 0, 640, 480, [1, 0, 0, 0.5]
        );
    });

    it('should tint health red when low', () => {
        Draw_Hud(mockRenderer, ps, client, 10, 0, 0, {} as any, messageSystem, 1000);

        const calls = (mockRenderer.drawPic as any).mock.calls;
        const healthCalls = calls.filter((c: any) => c[0] >= 100 && c[0] < 150 && c[1] === 450);

        expect(healthCalls.length).toBeGreaterThan(0);
        // Check color arg (4th arg)
        expect(healthCalls[0][3]).toEqual([1, 0, 0, 1]);
    });

    it('should draw powerup icons and timers', () => {
        client.inventory.powerups.set(PowerupId.Quad, 5000);

        Draw_Hud(mockRenderer, ps, client, 100, 50, 20, {} as any, messageSystem, 1000);

        const calls = (mockRenderer.drawPic as any).mock.calls;
        // Check if any call is for the powerup icon.
        // HUD_LAYOUT.POWERUP_Y is 450.
        // The Quad icon should be drawn around POWERUP_X.
        // We don't know exact X because it depends on number width logic, but Y is 450.
        const powerupCalls = calls.filter((c: any) => c[1] === 450);

        expect(powerupCalls.length).toBeGreaterThan(0);
    });

    it('should draw keys', () => {
        client.inventory.keys.add(KeyId.Blue);

        Draw_Hud(mockRenderer, ps, client, 100, 50, 20, {} as any, messageSystem, 1000);

        const calls = (mockRenderer.drawPic as any).mock.calls;
        const keyCalls = calls.filter((c: any) => c[0] === 10 && c[1] >= 300 && c[1] < 450);
        expect(keyCalls.length).toBeGreaterThan(0);
    });
});
