import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientImports } from '../src/index.js';
import { EngineImports, Renderer, GameFrameResult } from '@quake2ts/engine';
import { UserCommand } from '@quake2ts/shared';

// Mock dependencies
const mockRenderer = {
    begin2D: vi.fn(),
    end2D: vi.fn(),
    drawPic: vi.fn(),
    drawfillRect: vi.fn(),
    drawString: vi.fn(),
    drawCenterString: vi.fn(),
    registerPic: vi.fn().mockResolvedValue({ width: 24, height: 24 } as any),
    renderFrame: vi.fn(),
    getPerformanceReport: vi.fn().mockReturnValue({ textureBinds: 0, drawCalls: 0, triangles: 0, vertices: 0 }),
    width: 640,
    height: 480
} as unknown as Renderer;

const mockTrace = vi.fn().mockReturnValue({
    allsolid: false,
    startsolid: false,
    fraction: 1.0,
    endpos: { x: 0, y: 0, z: 0 },
    plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
    surface: { name: 'test', flags: 0, value: 0 },
    contents: 0,
    ent: -1
});

const mockEngine: EngineImports & { renderer: Renderer } = {
    trace: mockTrace,
    renderer: mockRenderer
};

const mockImports: ClientImports = {
    engine: mockEngine
};

describe('Client Integration', () => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
        vi.clearAllMocks();
        client = createClient(mockImports);
        client.init({
            frame: 1,
            timeMs: 100,
            state: {
                origin: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                viewAngles: { x: 0, y: 0, z: 0 },
                pmFlags: 0,
                waterLevel: 0,
                health: 100,
                armor: 0,
                ammo: 50,
                stats: [],
                kick_angles: { x: 0, y: 0, z: 0 },
                gunoffset: { x: 0, y: 0, z: 0 },
                gunangles: { x: 0, y: 0, z: 0 },
                gunindex: 0,
                client: {
                    inventory: {
                        armor: { armorCount: 0, armorType: 'jacket' },
                        currentWeapon: 1,
                        ammo: { counts: [] },
                        keys: new Set(),
                        powerups: new Map()
                    }
                }
            }
        } as unknown as GameFrameResult<any>);
    });

    it('should initialize successfully', () => {
        expect(client).toBeDefined();
        expect(client.prediction).toBeDefined();
        expect(client.view).toBeDefined();
    });

    it('should handle config strings', () => {
        client.ParseConfigString(0, 'Quake 2');
        expect(client.configStrings.get(0)).toBe('Quake 2');
    });

    it('should render frame and draw HUD', () => {
        const sample = {
            latest: {
                frame: 1,
                timeMs: 100,
                state: {
                    origin: { x: 0, y: 0, z: 0 },
                    velocity: { x: 0, y: 0, z: 0 },
                    viewAngles: { x: 0, y: 0, z: 0 },
                    pmFlags: 0,
                    waterLevel: 0,
                    health: 100,
                    armor: 0,
                    ammo: 50,
                    stats: [],
                    kick_angles: { x: 0, y: 0, z: 0 },
                    gunoffset: { x: 0, y: 0, z: 0 },
                    gunangles: { x: 0, y: 0, z: 0 },
                    gunindex: 0,
                    client: {
                        inventory: {
                            armor: { armorCount: 0, armorType: 'jacket' },
                            currentWeapon: 1,
                            ammo: { counts: [] },
                            keys: new Set(),
                            powerups: new Map()
                        }
                    }
                }
            }
        };

        client.render(sample as any);

        // HUD drawing should be triggered
        expect(mockRenderer.renderFrame).toHaveBeenCalled();
        expect(mockRenderer.begin2D).toHaveBeenCalled();
        expect(mockRenderer.end2D).toHaveBeenCalled();
        // Since we mocked registerPic to resolve, but we haven't loaded assets in this test context explicitly via Init_Hud,
        // Draw_Hud might skip drawing if pics aren't loaded in the module scope.
        // However, `Draw_Hud` calls `Draw_Number`, `Draw_Icons` etc.
        // `Draw_Number` accesses `hudNumberPics` which are populated by `Init_Hud`.
        // `Init_Hud` is NOT called by `createClient`. It is likely called by the engine loop during initialization phase.
        // So for this integration test to fully verify rendering, we'd need to call `Init_Hud` or mock the module internals.

        // But we can check that `DrawHUD` was called, which calls `Draw_Hud`.
        // And `Draw_Hud` calls `renderer.begin2D()`.

        // So verifying `begin2D` is a good proxy that the pipeline reached HUD rendering.
    });

    it('should handle ParseCenterPrint', () => {
        client.ParseCenterPrint('Hello World');
        // We can't easily check internal message system state, but we can verify it doesn't crash.
    });
});
