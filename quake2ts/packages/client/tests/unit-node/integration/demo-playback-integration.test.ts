import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports, ClientMode } from '@quake2ts/client/index.js';
import { DemoPlaybackController, EngineImports } from '@quake2ts/engine';
import { ClientNetworkHandler } from '@quake2ts/client/demo/handler.js';
import { DemoControls } from '@quake2ts/client/ui/demo-controls.js';
import { GetCGameAPI } from '@quake2ts/cgame';
import { Init_Hud } from '@quake2ts/client/hud.js';
import { createEmptyEntityState } from '@quake2ts/engine';
import {
    createMockCGameAPI,
    createMockClientPrediction,
    createMockViewEffects,
    createMockHudImports,
    createMockEngineImports,
    createMockRenderer
} from '@quake2ts/test-utils';

// Mock dependencies
vi.mock('@quake2ts/engine', async () => {
    const actual = await vi.importActual('@quake2ts/engine');
    return {
        ...actual,
        DemoPlaybackController: class {
            loadDemo = vi.fn();
            setHandler = vi.fn();
            update = vi.fn();
            stop = vi.fn();
            setSpeed = vi.fn();
            setFrameDuration = vi.fn();
            getCurrentTime = vi.fn().mockReturnValue(0);
            getDuration = vi.fn().mockReturnValue(100);
            getState = vi.fn();
            getSpeed = vi.fn().mockReturnValue(1);
            getPlaybackSpeed = vi.fn().mockReturnValue(1);
            getInterpolationFactor = vi.fn().mockReturnValue(0);
            play = vi.fn();
            pause = vi.fn();
            stepForward = vi.fn();
            stepBackward = vi.fn();
            seek = vi.fn();
            getCurrentFrame = vi.fn().mockReturnValue(0);
            getTotalFrames = vi.fn().mockReturnValue(100);
        },
        ClientRenderer: vi.fn(),
        createEmptyEntityState: vi.fn().mockReturnValue({ origin: {x:0,y:0,z:0} })
    };
});

vi.mock('@quake2ts/client/demo/handler.js', () => ({
    ClientNetworkHandler: class {
        setView = vi.fn();
        setCallbacks = vi.fn();
        getPredictionState = vi.fn().mockReturnValue({
             origin: { x: 0, y: 0, z: 0 },
             velocity: { x: 0, y: 0, z: 0 },
             viewAngles: { x: 0, y: 0, z: 0 },
             pmFlags: 0,
             fov: 90,
             client: {} // Added client property to satisfy rendering condition
        });
        getRenderableEntities = vi.fn().mockReturnValue([]);
        getDemoCamera = vi.fn().mockReturnValue({
             origin: { x: 0, y: 0, z: 0 },
             angles: { x: 0, y: 0, z: 0 },
             fov: 90
        });
        latestServerFrame = 100;
        entities = new Map();
    }
}));

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

vi.mock('@quake2ts/client/hud.js', async () => {
    const { createMockHudImports } = await import('@quake2ts/test-utils');
    return createMockHudImports();
});

vi.mock('@quake2ts/cgame', async () => {
    const { createMockClientPrediction, createMockViewEffects, createMockCGameAPI } = await import('@quake2ts/test-utils');
    return {
        ClientPrediction: vi.fn(function() { return createMockClientPrediction(); }),
        interpolatePredictionState: vi.fn(),
        ViewEffects: vi.fn(function() { return createMockViewEffects(); }),
        GetCGameAPI: vi.fn(() => createMockCGameAPI())
    };
});

// Also mock relative path for cgame as vitest might resolve alias
vi.mock('../../../cgame/src/index.ts', async () => {
    const { createMockClientPrediction, createMockViewEffects, createMockCGameAPI } = await import('@quake2ts/test-utils');
    return {
        ClientPrediction: vi.fn(function() { return createMockClientPrediction(); }),
        interpolatePredictionState: vi.fn(),
        ViewEffects: vi.fn(function() { return createMockViewEffects(); }),
        GetCGameAPI: vi.fn(() => createMockCGameAPI())
    };
});

vi.mock('@quake2ts/client/ui/menu/system.js', () => ({
    MenuSystem: class {
        isActive = vi.fn().mockReturnValue(false);
        closeAll = vi.fn();
        pushMenu = vi.fn();
        render = vi.fn();
        handleInput = vi.fn();
        getState = vi.fn().mockReturnValue({});
        onStateChange = null;
    }
}));

// Mock BrowserWebSocketNetDriver to avoid WebSocket dependency
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
    let mockEngine: EngineImports & { renderer: any, cmd: any };
    let mockRenderer: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Restore common mocks cleared by mockReset: true
        vi.mocked(GetCGameAPI).mockImplementation(() => createMockCGameAPI());
        vi.mocked(Init_Hud).mockResolvedValue(undefined);
        if (vi.isMockFunction(createEmptyEntityState)) {
             vi.mocked(createEmptyEntityState).mockReturnValue({ origin: { x: 0, y: 0, z: 0 } } as any);
        }

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

        mockRenderer = createMockRenderer({
            width: 800,
            height: 600,
        });

        // Use createMockEngineImports which now includes cmd and audio defaults
        const engineImports = createMockEngineImports({
            renderer: mockRenderer,
            assets: {
                listFiles: vi.fn().mockReturnValue([]),
                getMap: vi.fn(),
                loadTexture: vi.fn().mockResolvedValue({ width: 32, height: 32 }), // Mock loadTexture
            } as any,
        });

        // We need to cast because createMockEngineImports returns EngineImports
        // but Client expects EngineImports & { cmd: ... }
        // createMockEngineImports now returns an object that HAS cmd, but the type signature might not reflect it
        // if we import the type from engine.
        // But functionally it is there.
        mockEngine = engineImports as any;

        const imports: ClientImports = {
            engine: mockEngine,
            host: {
                cvars: {
                    get: vi.fn().mockReturnValue({ string: '', number: 90 }),
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
        };

        client.render(sample);

        // Should call demoPlayback.update
        // First call sets lastRenderTime, so update might be called with 0 or small dt
        // Let's call it twice to ensure dt > 0
        client.render({ ...sample, nowMs: 1016 });

        expect(client.demoPlayback.update).toHaveBeenCalled();
    });

    it('should use demo camera and entities during playback', () => {
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

        client.render({ nowMs: 1000, alpha: 1.0, latest: null, previous: null });

        expect(client.demoHandler.getRenderableEntities).toHaveBeenCalled();
        expect(client.demoHandler.getDemoCamera).toHaveBeenCalled();
        expect(mockRenderer.renderFrame).toHaveBeenCalled();
    });

    it('should render demo controls', () => {
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

        // Mock render loop that eventually calls DrawHUD
        client.render({ nowMs: 1000, alpha: 1.0, latest: null, previous: null });

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
