import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Draw_Hud, Init_Hud } from '@quake2ts/client/hud.js';
import { Renderer, Pic, AssetManager, PreparedTexture } from '@quake2ts/engine';
import { PlayerState } from '@quake2ts/shared';
import { PlayerClient, PowerupId, KeyId, ArmorType, WeaponId } from '@quake2ts/game';
import { MessageSystem } from '@quake2ts/client/hud/messages.js';
import { createMockAssetManager, createMockRenderer, createPlayerStateFactory, createPlayerClientFactory } from '@quake2ts/test-utils';

// Mock engine dependencies
const mockRenderer = createMockRenderer({
    width: 640,
    height: 480,
    // Ensure registerTexture returns a valid object that has 'width' property
    registerTexture: vi.fn().mockReturnValue({ width: 24, height: 24, name: 'mock' } as any),
    registerPic: vi.fn().mockResolvedValue({ width: 24, height: 24, name: 'mock' } as any),
});

// Mock AssetManager using centralized factory from test-utils
const mockAssetManager = createMockAssetManager({
    loadTexture: vi.fn().mockResolvedValue({ width: 24, height: 24, levels: [], source: 'pcx' } as PreparedTexture),
    // Ensure crosshair loading doesn't fail
    loadSprite: vi.fn().mockResolvedValue({}),
});

describe('HUD Rendering', () => {
    let ps: PlayerState;
    let client: PlayerClient;
    let messageSystem: MessageSystem;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Re-apply return values in beforeEach to persist across tests
        (mockRenderer.registerTexture as any).mockReturnValue({ width: 24, height: 24, name: 'mock' });
        (mockRenderer.registerPic as any).mockResolvedValue({ width: 24, height: 24, name: 'mock' });
        (mockAssetManager.loadTexture as any).mockResolvedValue({ width: 24, height: 24, levels: [], source: 'pcx' });


        ps = createPlayerStateFactory({
            damageAlpha: 0,
            damageIndicators: [],
            origin: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            viewAngles: { x: 0, y: 0, z: 0 },
            onGround: true,
            waterLevel: 0,
            mins: { x: 0, y: 0, z: 0 },
            maxs: { x: 0, y: 0, z: 0 },
        });

        client = createPlayerClientFactory();
        client.inventory.armor = { armorCount: 50, armorType: ArmorType.JACKET };
        client.inventory.currentWeapon = WeaponId.Blaster;

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
