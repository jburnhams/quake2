import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Draw_Hud, Init_Hud } from '../src/hud.js';
import { Renderer, Pic, PakArchive } from '@quake2ts/engine';
import { PlayerState } from '@quake2ts/shared';
import { PlayerClient, PowerupId } from '@quake2ts/game';
import { MessageSystem } from '../src/hud/messages.js';

// Mock engine dependencies
const mockRenderer = {
    begin2D: vi.fn(),
    end2D: vi.fn(),
    drawPic: vi.fn(),
    drawfillRect: vi.fn(),
    drawString: vi.fn(),
    drawCenterString: vi.fn(),
    registerPic: vi.fn().mockResolvedValue({ width: 24, height: 24 } as Pic),
    width: 640,
    height: 480
} as unknown as Renderer;

const mockPak = {
    readFile: vi.fn().mockReturnValue({ buffer: new ArrayBuffer(0) })
} as unknown as PakArchive;

describe('HUD Rendering', () => {
    let ps: PlayerState;
    let client: PlayerClient;
    let messageSystem: MessageSystem;

    beforeEach(() => {
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

        // Initialize HUD assets
        return Init_Hud(mockRenderer, mockPak);
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
        // We can't easily check the color argument to drawPic since it's deeply nested in Draw_Number
        // But we can check that drawPic was called.
        // To be precise we'd need to mock Draw_Number or spy on it.
        // Instead, let's trust the logic is calling it, and maybe check if we can spy on renderer.drawPic arguments.

        Draw_Hud(mockRenderer, ps, client, 10, 0, 0, {} as any, messageSystem, 1000);

        // The first calls to drawPic are for health numbers.
        // HUD_LAYOUT.HEALTH_X is 100.
        // We expect drawPic to be called with x >= 100 and a color.

        const calls = (mockRenderer.drawPic as any).mock.calls;
        const healthCalls = calls.filter((c: any) => c[0] >= 100 && c[0] < 150 && c[1] === 450);

        expect(healthCalls.length).toBeGreaterThan(0);
        // Check color arg (4th arg)
        expect(healthCalls[0][3]).toEqual([1, 0, 0, 1]);
    });

    it('should draw powerup icons and timers', () => {
        // Add a powerup
        client.inventory.powerups.set(PowerupId.Quad, 5000); // Expires at 5000ms

        // Time is 1000ms, so 4 seconds remaining.
        Draw_Hud(mockRenderer, ps, client, 100, 50, 20, {} as any, messageSystem, 1000);

        // Check if Quad icon was drawn.
        // Since we mocked loading, we don't have real Pic objects with names.
        // But Init_Icons registers 'p_quad'.
        // We can check if registerPic was called for p_quad.
        expect(mockRenderer.registerPic).toHaveBeenCalledWith('p_quad', expect.any(Object));

        // And check if drawPic was called for powerup area.
        // HUD_LAYOUT.POWERUP_Y = 450.
        const calls = (mockRenderer.drawPic as any).mock.calls;
        const powerupCalls = calls.filter((c: any) => c[1] === 450 && c[0] > 550); // Powerup area
        expect(powerupCalls.length).toBeGreaterThan(0);
    });

    it('should draw keys', () => {
        client.inventory.keys.add('blue');

        Draw_Hud(mockRenderer, ps, client, 100, 50, 20, {} as any, messageSystem, 1000);

        // Keys are drawn at X=10, Y starts at 300.
        const calls = (mockRenderer.drawPic as any).mock.calls;
        const keyCalls = calls.filter((c: any) => c[0] === 10 && c[1] >= 300 && c[1] < 450);
        expect(keyCalls.length).toBeGreaterThan(0);
    });
});
