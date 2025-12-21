import { vi } from 'vitest';
import { PlayerState } from '@quake2ts/shared';
import { PlayerClient, PowerupId, KeyId } from '@quake2ts/game';
import { FrameRenderStats } from '@quake2ts/engine';

// Since test-utils cannot import from client, we need to mock MessageSystem here or define an interface
// The Draw_Hud function expects a MessageSystem which has drawCenterPrint and drawNotifications.
// However, the signature in `hud.ts` uses the class.
// For testing purposes, we might need a mock MessageSystem interface in test-utils or import it if possible.
// But we can't import from client. So we will return a mock object that satisfies the interface.

export interface HudState {
    ps: PlayerState;
    client: PlayerClient;
    health: number;
    armor: number;
    ammo: number;
    stats: FrameRenderStats;
    timeMs: number;
    messages: any; // Using any for now to avoid circular dependency
}

export function createMockHudState(overrides?: Partial<HudState>): HudState {
    const defaultPs = {
        damageAlpha: 0,
        damageIndicators: [],
        origin: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        viewAngles: { x: 0, y: 0, z: 0 },
        onGround: true,
        waterLevel: 0,
        mins: { x: 0, y: 0, z: 0 },
        maxs: { x: 0, y: 0, z: 0 },
        centerPrint: null,
        notify: null
    } as unknown as PlayerState;

    const defaultClient = {
        inventory: {
            armor: { armorCount: 50, armorType: 'jacket' },
            currentWeapon: 1, // Blaster usually
            ammo: { counts: [] },
            keys: new Set<KeyId>(),
            powerups: new Map<PowerupId, number>()
        }
    } as unknown as PlayerClient;

    const defaultStats: FrameRenderStats = {
        fps: 60,
        drawCalls: 100,
        facesDrawn: 1000,
        skyDrawn: true,
        viewModelDrawn: true,
        vertexCount: 10000,
        batches: 10
    };

    const defaultMessages = {
        drawCenterPrint: vi.fn(),
        drawNotifications: vi.fn(),
        addCenterPrint: vi.fn(),
        addNotification: vi.fn(),
        clear: vi.fn()
    };

    return {
        ps: overrides?.ps ?? defaultPs,
        client: overrides?.client ?? defaultClient,
        health: overrides?.health ?? 100,
        armor: overrides?.armor ?? 50,
        ammo: overrides?.ammo ?? 20,
        stats: overrides?.stats ?? defaultStats,
        timeMs: overrides?.timeMs ?? 1000,
        messages: overrides?.messages ?? defaultMessages
    };
}

export function createMockScoreboard(players: any[] = []): any {
    return {
        players: players,
        draw: vi.fn()
    };
}

export interface MockChatMessage {
    text: string;
    sender?: string;
    timestamp?: number;
}

export function createMockChatMessage(text: string, sender?: string, timestamp: number = Date.now()): MockChatMessage {
    return {
        text,
        sender,
        timestamp
    };
}

export interface MockNotification {
    type: string;
    message: string;
    duration?: number;
}

export function createMockNotification(type: string, message: string, duration: number = 3000): MockNotification {
    return {
        type,
        message,
        duration
    };
}
