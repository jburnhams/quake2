import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '@quake2ts/client/index.js';
import { DemoRecorder } from '@quake2ts/engine';
import { createMockEngineImports, createMockEngineHost } from '@quake2ts/test-utils';
import { resetCommonClientMocks } from '../test-helpers.js';

// Mock dependencies
vi.mock('@quake2ts/engine', async () => {
    const actual = await vi.importActual<typeof import('@quake2ts/engine')>('@quake2ts/engine');
    const utils = await vi.importActual<typeof import('@quake2ts/test-utils')>('@quake2ts/test-utils');

    // Create a spy wrapper for the class to allow instance capture
    const MockDemoRecorderSpy = vi.fn(function() { return new utils.MockDemoRecorder(); });

    return {
        ...actual,
        DemoRecorder: MockDemoRecorderSpy,
        DemoPlaybackController: utils.MockDemoPlaybackController,
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

vi.mock('@quake2ts/client/ui/menu/system.js', async () => {
    const utils = await vi.importActual<typeof import('@quake2ts/test-utils')>('@quake2ts/test-utils');
    return {
        MenuSystem: utils.MockMenuSystem
    };
});

vi.mock('@quake2ts/client/hud.js', () => ({
    Init_Hud: vi.fn().mockResolvedValue(undefined),
    Draw_Hud: vi.fn()
}));

vi.mock('@quake2ts/cgame', async () => {
    const utils = await vi.importActual<typeof import('@quake2ts/test-utils')>('@quake2ts/test-utils');
    return {
        ClientPrediction: utils.MockClientPrediction,
        interpolatePredictionState: vi.fn(),
        ViewEffects: utils.MockViewEffects,
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

vi.mock('../../../cgame/src/index.ts', async () => {
    const utils = await vi.importActual<typeof import('@quake2ts/test-utils')>('@quake2ts/test-utils');
    return {
        ClientPrediction: utils.MockClientPrediction,
        interpolatePredictionState: vi.fn(),
        ViewEffects: utils.MockViewEffects,
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

describe('Demo Recording Integration', () => {
    let client: ClientExports;
    let mockEngine: any;
    let mockRecorderInstance: any;

    beforeEach(() => {
        vi.clearAllMocks();
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

        const mockRenderer = {
            width: 800,
            height: 600,
            renderFrame: vi.fn(),
            begin2D: vi.fn(),
            end2D: vi.fn(),
            drawfillRect: vi.fn(),
            drawString: vi.fn(),
            drawCenterString: vi.fn(),
            registerTexture: vi.fn(),
            registerPic: vi.fn(),
            getPerformanceReport: vi.fn().mockReturnValue({ textureBinds: 0, drawCalls: 0, triangles: 0, vertices: 0 }),
            setGamma: vi.fn(),
            setBrightness: vi.fn(),
            setBloom: vi.fn(),
            setBloomIntensity: vi.fn(),
            setUnderwaterWarp: vi.fn(),
        };

        const engineImports = createMockEngineImports({
            renderer: mockRenderer,
            cmd: {
                executeText: vi.fn(),
                register: vi.fn()
            } as any,
            audio: {
                sound: vi.fn(),
                positioned_sound: vi.fn(),
                set_music_volume: vi.fn(),
                play_track: vi.fn(),
                play_music: vi.fn(),
                stop_music: vi.fn()
            } as any
        });

        engineImports.assets.loadTexture = vi.fn().mockResolvedValue({ width: 32, height: 32 });
        mockEngine = engineImports;

        const host = createMockEngineHost();
        host.cvars.get = vi.fn().mockReturnValue({ string: '', number: 0 });

        const imports: ClientImports = {
            engine: mockEngine,
            host: host
        };

        client = createClient(imports);
        client.Init();

        // Capture the recorder instance created by createClient
        mockRecorderInstance = vi.mocked(DemoRecorder).mock.results[0].value;

        // Configure specific behavior needed for tests
        mockRecorderInstance.stopRecording.mockReturnValue(new Uint8Array([1, 2, 3]));
        mockRecorderInstance.getIsRecording.mockReturnValue(true);
    });

    it('should set demo recorder on multiplayer connection', () => {
        expect(client.multiplayer).toBeDefined();
        // Verify that the DemoRecorder constructor was called during client initialization
        expect(DemoRecorder).toHaveBeenCalled();

        vi.spyOn(client.multiplayer, 'isConnected').mockReturnValue(true);
        client.startRecording('test_setup.dm2');
        expect(mockRecorderInstance.startRecording).toHaveBeenCalledWith('test_setup.dm2');
    });

    it('should start recording when connected', () => {
        if (!mockRecorderInstance) return;

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

        client.stopRecording();

        expect(mockRecorderInstance.stopRecording).toHaveBeenCalled();
        expect(mockAnchor.click).toHaveBeenCalled();
        expect(mockAnchor.download).toBe('demo.dm2');
    });
});
