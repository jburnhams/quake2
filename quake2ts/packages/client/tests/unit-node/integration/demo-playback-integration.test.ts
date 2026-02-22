import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports, ClientMode } from '@quake2ts/client/index.js';
import { DemoControls } from '@quake2ts/client/ui/demo-controls.js';
import { resetCommonClientMocks } from '../test-helpers.js';
import { createMockEngineImports, createMockEngineHost } from '@quake2ts/test-utils';

// Mock dependencies
vi.mock('@quake2ts/engine', async () => {
    const actual = await vi.importActual<typeof import('@quake2ts/engine')>('@quake2ts/engine');
    const utils = await vi.importActual<typeof import('@quake2ts/test-utils')>('@quake2ts/test-utils');
    return {
        ...actual,
        DemoPlaybackController: utils.MockDemoPlaybackController,
        ClientRenderer: vi.fn(),
        createEmptyEntityState: vi.fn().mockReturnValue({ origin: {x:0,y:0,z:0} })
    };
});

vi.mock('@quake2ts/client/demo/handler.js', async () => {
    const utils = await vi.importActual<typeof import('@quake2ts/test-utils')>('@quake2ts/test-utils');
    return {
        ClientNetworkHandler: utils.MockClientNetworkHandler
    };
});

vi.mock('@quake2ts/client/ui/demo-controls.js', () => ({
    DemoControls: vi.fn(function() {
        return {
            render: vi.fn(),
            handleInput: vi.fn().mockReturnValue(false),
            setDemoName: vi.fn()
        };
    })
}));

// Mock cgameBridge to avoid complex dependencies
vi.mock('@quake2ts/client/cgameBridge.js', () => ({
    createCGameImport: vi.fn(),
    ClientStateProvider: vi.fn()
}));

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
            ParseCenterPrint: vi.fn(),
            NotifyMessage: vi.fn(),
            ParseConfigString: vi.fn(),
            ShowSubtitle: vi.fn()
        })
    };
});

// Also mock relative path for cgame as vitest might resolve alias
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
            ParseCenterPrint: vi.fn(),
            NotifyMessage: vi.fn(),
            ParseConfigString: vi.fn(),
            ShowSubtitle: vi.fn()
        })
    };
});

vi.mock('@quake2ts/client/ui/menu/system.js', async () => {
    const utils = await vi.importActual<typeof import('@quake2ts/test-utils')>('@quake2ts/test-utils');
    return {
        MenuSystem: utils.MockMenuSystem
    };
});

// Mock BrowserWebSocketNetDriver to avoid WebSocket dependency
// This allows MultiplayerConnection to be instantiated normally but with a mocked driver
vi.mock('../../../src/net/browserWsDriver.ts', () => ({
    BrowserWebSocketNetDriver: class {
        connect = vi.fn().mockResolvedValue(undefined);
        disconnect = vi.fn();
        send = vi.fn();
        onMessage = vi.fn();
        onClose = vi.fn();
        onError = vi.fn();
        isConnected = vi.fn().mockReturnValue(false);
    }
}));

describe('Demo Playback Integration', () => {
    let client: ClientExports;
    let mockEngine: any;
    let mockRenderer: any;

    beforeEach(() => {
        vi.clearAllMocks();
        resetCommonClientMocks();

        // Mock localStorage if missing (for Node environment)
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

        mockRenderer = {
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

        // Ensure assets mock behaves correctly
        engineImports.assets.loadTexture = vi.fn().mockResolvedValue({ width: 32, height: 32 });

        mockEngine = engineImports;

        const host = createMockEngineHost();
        host.cvars.get = vi.fn().mockReturnValue({ string: '', number: 90 }); // Default override

        const imports: ClientImports = {
            engine: mockEngine,
            host: host
        };

        client = createClient(imports);
        client.Init();
    });

    it('should initialize in Normal mode', () => {
        expect(client.mode).toBe(ClientMode.Normal);
        expect(client.isDemoPlaying).toBe(false);
        expect(client.currentDemoName).toBeNull();
    });

    it('should start demo playback correctly', () => {
        const buffer = new ArrayBuffer(100);
        const filename = 'test.dm2';

        client.startDemoPlayback(buffer, filename);

        expect(client.mode).toBe(ClientMode.DemoPlayback);
        expect(client.isDemoPlaying).toBe(true);
        expect(client.currentDemoName).toBe(filename);

        expect(client.demoPlayback.loadDemo).toHaveBeenCalledWith(buffer);
        expect(client.demoPlayback.setHandler).toHaveBeenCalledWith(client.demoHandler);
    });

    it('should stop demo playback correctly', () => {
        // First start
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

        // Then stop
        client.stopDemoPlayback();

        expect(client.mode).toBe(ClientMode.Normal);
        expect(client.isDemoPlaying).toBe(false);
        expect(client.currentDemoName).toBeNull();
        expect(client.demoPlayback.stop).toHaveBeenCalled();
    });

    it('should update demo playback in sample loop', () => {
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

        const sample = {
            nowMs: 1000,
            alpha: 1.0,
            latest: null,
            previous: null
        } as any;

        client.render(sample);

        // Should call demoPlayback.update
        // First call sets lastRenderTime, so update might be called with 0 or small dt
        // Let's call it twice to ensure dt > 0
        client.render({ ...sample, nowMs: 1016 });

        expect(client.demoPlayback.update).toHaveBeenCalled();
    });

    it('should use demo camera and entities during playback', () => {
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

        client.render({ nowMs: 1000, alpha: 1.0, latest: null, previous: null } as any);

        expect(client.demoHandler.getRenderableEntities).toHaveBeenCalled();
        expect(client.demoHandler.getDemoCamera).toHaveBeenCalled();
        expect(mockRenderer.renderFrame).toHaveBeenCalled();
    });

    it('should render demo controls', () => {
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

        // Mock render loop that eventually calls DrawHUD
        client.render({ nowMs: 1000, alpha: 1.0, latest: null, previous: null } as any);

        // Access the mocked instance of DemoControls
        const controlsMock = vi.mocked(DemoControls).mock.results[0].value;

        // We expect the controls to be rendered
        expect(controlsMock.render).toHaveBeenCalledWith(mockRenderer, mockRenderer.width, mockRenderer.height);
    });

    it('should handle demo input', () => {
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

        // Mock demoControls to return true for a key
        const controlsMock = vi.mocked(DemoControls).mock.results[0].value;
        controlsMock.handleInput.mockReturnValue(true);

        const consumed = client.handleInput('Space', true);
        expect(consumed).toBe(true);
        expect(controlsMock.handleInput).toHaveBeenCalledWith('Space', true);
    });

    it('should allow togglemenu during demo playback', () => {
         client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

         const controlsMock = vi.mocked(DemoControls).mock.results[0].value;
         controlsMock.handleInput.mockReturnValue(false); // Not consumed by demo controls

         const consumed = client.handleInput('Escape', true);

         expect(consumed).toBe(false);
    });
});
