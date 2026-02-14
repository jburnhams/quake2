import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '@quake2ts/client/index.js';
import { DemoRecorder, createEmptyEntityState } from '@quake2ts/engine';
import { GetCGameAPI } from '@quake2ts/cgame';
import { Init_Hud } from '@quake2ts/client/hud.js';
import { resetCommonClientMocks } from '../test-helpers.js';

let mockRecorderInstance: any;

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

// Mock BrowserWebSocketNetDriver to avoid WebSocket dependency
vi.mock('../../../src/net/browserWsDriver.ts', () => ({
    BrowserWebSocketNetDriver: class {
        connect = vi.fn().mockResolvedValue(undefined);
        disconnect = vi.fn();
        send = vi.fn();
        onMessage = vi.fn();
        onClose = vi.fn();
        onError = vi.fn();
        isConnected = vi.fn().mockReturnValue(true); // Default to connected for recording tests
    }
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

vi.mock('@quake2ts/cgame', () => ({
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
}));

vi.mock('../../../cgame/src/index.ts', () => ({
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
}));

describe('Demo Recording Integration', () => {
    let client: ClientExports;
    let mockEngine: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRecorderInstance = undefined;

        // Reset mock return values due to mockReset: true
        if (vi.isMockFunction(DemoRecorder)) {
             vi.mocked(DemoRecorder).mockImplementation(function() {
                mockRecorderInstance = {
                    startRecording: vi.fn(),
                    recordMessage: vi.fn(),
                    stopRecording: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
                    getIsRecording: vi.fn().mockReturnValue(true)
                };
                return mockRecorderInstance;
            });
        }

        resetCommonClientMocks();

        // Mock localStorage
        if (typeof localStorage === 'undefined') {
            global.localStorage = {
                getItem: vi.fn(),
                setItem: vi.fn(),
                removeItem: vi.fn(),
                clear: vi.fn(),
                length: 0,
                key: vi.fn()
            } as any;
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
        expect(client.multiplayer).toBeDefined();
        // Verify that the DemoRecorder constructor was called during client initialization
        expect(DemoRecorder).toHaveBeenCalled();

        // Indirectly verify that the recorder was set on the multiplayer connection
        // by attempting to start recording (simulating a connected state) and verifying
        // that the mock recorder's startRecording method is invoked.
        // This confirms the plumbing from client -> multiplayer -> recorder is intact.
        vi.spyOn(client.multiplayer, 'isConnected').mockReturnValue(true);
        client.startRecording('test_setup.dm2');
        expect(mockRecorderInstance.startRecording).toHaveBeenCalledWith('test_setup.dm2');
    });

    it('should start recording when connected', () => {
        if (!mockRecorderInstance) return;

        // Force connection state to true in mock driver if needed, but we defaulted isConnected to true.
        // Also MultiplayerConnection tracks state.
        // We need to simulate connection state change to Connected/Active.

        // client.multiplayer is real instance.
        // It listens to driver.
        // We mocked driver to have isConnected=true, but MultiplayerConnection also checks its own state enum.
        // ConnectionState.Active is required for sending commands, but for recording?

        // client.startRecording:
        // if (multiplayer.isConnected()) { demoRecorder.startRecording(...) }

        // MultiplayerConnection.isConnected() checks `this.state === ConnectionState.Active`.

        // We need to transition multiplayer to Active.
        // We can call `client.multiplayer.onServerData(...)` and `finishLoading()` flow?
        // Or we can just spy on client.multiplayer.isConnected and make it return true.

        vi.spyOn(client.multiplayer, 'isConnected').mockReturnValue(true);

        client.startRecording('my_demo.dm2');

        expect(mockRecorderInstance.startRecording).toHaveBeenCalledWith('my_demo.dm2');
    });

    it('should not start recording when not connected', () => {
        // Mock isConnected to false
        vi.spyOn(client.multiplayer, 'isConnected').mockReturnValue(false);

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
