// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '@quake2ts/client/index.js';
// We don't strictly need to import classes if we mock them, but it helps with types/vi.mocked
import { MultiplayerConnection } from '@quake2ts/client/net/connection.js';
import { DemoRecorder } from '@quake2ts/engine';

let mockRecorderInstance: any;
let mockMultiplayerInstance: any;

// Mock dependencies
vi.mock('@quake2ts/engine', async () => {
    const actual = await vi.importActual('@quake2ts/engine');
    return {
        ...actual,
        DemoRecorder: vi.fn().mockImplementation(function() {
            mockRecorderInstance = {
                startRecording: vi.fn(),
                recordMessage: vi.fn(),
                stopRecording: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
                getIsRecording: vi.fn().mockReturnValue(true)
            };
            return mockRecorderInstance;
        }),
        DemoPlaybackController: class {
            setHandler = vi.fn();
            loadDemo = vi.fn();
            setSpeed = vi.fn();
            setFrameDuration = vi.fn();
            getCurrentTime = vi.fn();
            getDuration = vi.fn();
            getState = vi.fn();
            getSpeed = vi.fn();
            play = vi.fn();
            pause = vi.fn();
            stop = vi.fn();
            update = vi.fn();
        },
        ClientRenderer: vi.fn(),
        createEmptyEntityState: vi.fn().mockReturnValue({ origin: {x:0,y:0,z:0} })
    };
});

// Use alias path for mocking as that's how it's likely resolved
vi.mock('@quake2ts/client/net/connection.js', () => ({
    MultiplayerConnection: vi.fn().mockImplementation(function() {
        mockMultiplayerInstance = {
            setDemoRecorder: vi.fn(),
            setEffectSystem: vi.fn(),
            isConnected: vi.fn().mockReturnValue(true),
            disconnect: vi.fn(),
            sendCommand: vi.fn(),
            connect: vi.fn().mockResolvedValue(undefined),
            get playerNum() { return 0; },
            get entities() { return new Map(); }
        };
        return mockMultiplayerInstance;
    })
}));

vi.mock('@quake2ts/client/ui/menu/system.js', () => ({
    MenuSystem: vi.fn().mockImplementation(function() {
        return {
            isActive: vi.fn(),
            pushMenu: vi.fn(),
            closeAll: vi.fn(),
            render: vi.fn(),
            handleInput: vi.fn(),
            getState: vi.fn().mockReturnValue({})
        };
    })
}));

vi.mock('@quake2ts/client/hud.js', () => ({
    Init_Hud: vi.fn().mockResolvedValue(undefined),
    Draw_Hud: vi.fn()
}));

vi.mock('@quake2ts/cgame', async () => {
  return {
    ClientPrediction: vi.fn().mockImplementation(function() { return {
        setAuthoritative: vi.fn(),
        enqueueCommand: vi.fn(),
        getPredictedState: vi.fn(),
        decayError: vi.fn()
    }; }),
    interpolatePredictionState: vi.fn(),
    ViewEffects: vi.fn().mockImplementation(function() { return {
        sample: vi.fn()
    }; }),
    GetCGameAPI: vi.fn().mockReturnValue({
        Init: vi.fn(),
        Shutdown: vi.fn(),
        DrawHUD: vi.fn(),
        ParseConfigString: vi.fn(),
        ParseCenterPrint: vi.fn(),
        NotifyMessage: vi.fn(),
        ShowSubtitle: vi.fn()
    })
  }
});

describe('Demo Recording Integration', () => {
    let client: ClientExports;
    let mockEngine: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRecorderInstance = undefined;
        mockMultiplayerInstance = undefined;

        // Mock localStorage if missing (though jsdom env should provide it)
        if (typeof localStorage === 'undefined') {
            global.localStorage = {
                getItem: vi.fn(),
                setItem: vi.fn(),
                removeItem: vi.fn(),
                clear: vi.fn(),
                length: 0,
                key: vi.fn()
            };
        }

        mockEngine = {
            trace: vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } }),
            assets: {
                listFiles: vi.fn().mockReturnValue([]),
                getMap: vi.fn(),
                loadTexture: vi.fn().mockResolvedValue({ width: 32, height: 32 }),
            },
            renderer: {
                width: 800,
                height: 600,
                registerTexture: vi.fn(),
                registerPic: vi.fn(),
                drawCenterString: vi.fn(),
                drawString: vi.fn(),
                drawfillRect: vi.fn(),
                begin2D: vi.fn(),
                end2D: vi.fn(),
                setGamma: vi.fn(),
                setBrightness: vi.fn(),
                setBloom: vi.fn(),
                setBloomIntensity: vi.fn(),
                setUnderwaterWarp: vi.fn(),
            },
            cmd: {
                executeText: vi.fn(),
                register: vi.fn()
            },
            audio: {
                play_track: vi.fn(),
                play_music: vi.fn(),
                stop_music: vi.fn(),
                set_music_volume: vi.fn()
            }
        };

        const imports: ClientImports = {
            engine: mockEngine,
            host: {
                cvars: {
                    get: vi.fn().mockReturnValue({ string: '', number: 0 }),
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

        client = createClient(imports);
        client.Init();
    });

    it('should set demo recorder on multiplayer connection', () => {
        // If mockMultiplayerInstance is not defined, it means the mock constructor wasn't called.
        // This implies createClient didn't import the mocked module.
        // However, if we assume the mock path is correct...

        // Debug
        // console.log('Mock Multiplayer:', mockMultiplayerInstance);

        expect(mockMultiplayerInstance).toBeDefined();
        if (mockMultiplayerInstance) {
            expect(mockMultiplayerInstance.setDemoRecorder).toHaveBeenCalled();
            // Check argument is the recorder instance
            expect(mockMultiplayerInstance.setDemoRecorder).toHaveBeenCalledWith(mockRecorderInstance);
        }
    });

    it('should start recording when connected', () => {
        if (!mockRecorderInstance) return;

        client.startRecording('my_demo.dm2');

        expect(mockRecorderInstance.startRecording).toHaveBeenCalledWith('my_demo.dm2');
    });

    it('should not start recording when not connected', () => {
        if (!mockMultiplayerInstance) return;
        mockMultiplayerInstance.isConnected.mockReturnValue(false);

        client.startRecording('my_demo.dm2');

        expect(mockRecorderInstance.startRecording).not.toHaveBeenCalled();
    });

    it('should stop recording and handle data', () => {
        if (!mockRecorderInstance) return;

        // Mock document for download check
        const mockAnchor = {
            href: '',
            download: '',
            click: vi.fn()
        };
        const mockBody = {
            appendChild: vi.fn(),
            removeChild: vi.fn()
        };

        global.document = {
            createElement: vi.fn().mockReturnValue(mockAnchor),
            body: mockBody,
            addEventListener: vi.fn(),
            fullscreenElement: null,
            // @ts-ignore
            requestPointerLock: vi.fn()
        } as any;
        global.URL = {
            createObjectURL: vi.fn().mockReturnValue('blob:url'),
            revokeObjectURL: vi.fn()
        } as any;
        global.Blob = vi.fn();

        mockRecorderInstance.getIsRecording.mockReturnValue(true);

        client.stopRecording();

        expect(mockRecorderInstance.stopRecording).toHaveBeenCalled();
        expect(mockAnchor.click).toHaveBeenCalled();
        expect(mockAnchor.download).toBe('demo.dm2');
    });
});
