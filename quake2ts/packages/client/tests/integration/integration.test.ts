// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '@quake2ts/client/index.js';
import { EngineImports, Renderer, GameFrameResult } from '@quake2ts/engine';
import { createMockRenderer } from '@quake2ts/test-utils';

// Mock dependencies
const mockRenderer = createMockRenderer({
    width: 640,
    height: 480,
    registerPic: vi.fn().mockResolvedValue({ width: 24, height: 24 } as any),
});

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
    renderer: mockRenderer,
    assets: {
        getMap: vi.fn(),
        listFiles: vi.fn().mockReturnValue([]),
        loadTexture: vi.fn().mockResolvedValue({ width: 32, height: 32 })
    } as any,
    audio: {
        play_track: vi.fn(),
        play_music: vi.fn(),
        stop_music: vi.fn(),
        set_music_volume: vi.fn()
    } as any
};

const mockImports: ClientImports = {
    engine: mockEngine,
    host: {
        cvars: {
            get: vi.fn(),
            setValue: vi.fn(),
            list: vi.fn().mockReturnValue([]),
            register: vi.fn()
        },
        commands: {
            register: vi.fn(),
            execute: vi.fn()
        }
    } as any
};

// Mock @quake2ts/cgame to avoid complex dependency issues in integration test
vi.mock('@quake2ts/cgame', async () => {
    return {
        ClientPrediction: class {
            constructor() {}
            setAuthoritative() {}
            enqueueCommand() {
                return {
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
                };
            }
            getPredictedState() {
                return this.enqueueCommand(); // Return dummy state
            }
            decayError() {}
        },
        interpolatePredictionState: vi.fn().mockReturnValue({
            origin: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            viewAngles: { x: 0, y: 0, z: 0 },
            pmFlags: 0,
            waterLevel: 0
        }),
        ViewEffects: class {
            sample() { return { offset: {x:0,y:0,z:0}, angles: {x:0,y:0,z:0} }; }
        },
        GetCGameAPI: vi.fn().mockReturnValue({
            Init: vi.fn(),
            Shutdown: vi.fn(),
            DrawHUD: vi.fn(),
            ParseConfigString: vi.fn(),
            ParseCenterPrint: vi.fn(),
            NotifyMessage: vi.fn(),
            ShowSubtitle: vi.fn()
        })
    };
});

describe('Client Integration', () => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mockTrace return value to be safe
        mockTrace.mockReturnValue({
            allsolid: false,
            startsolid: false,
            fraction: 1.0,
            endpos: { x: 0, y: 0, z: 0 },
            plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
            surface: { name: 'test', flags: 0, value: 0 },
            contents: 0,
            ent: -1
        });

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
    });

    it('should handle ParseCenterPrint', () => {
        client.ParseCenterPrint('Hello World');
    });
});
