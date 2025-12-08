import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '../../src/index.js';
// We don't strictly need to import classes if we mock them, but it helps with types/vi.mocked
import { MultiplayerConnection } from '../../src/net/connection.js';
import { DemoRecorder } from '@quake2ts/engine';

let mockRecorderInstance: any;
let mockMultiplayerInstance: any;

// Mock dependencies
vi.mock('@quake2ts/engine', async () => {
    const actual = await vi.importActual('@quake2ts/engine');
    return {
        ...actual,
        DemoRecorder: vi.fn().mockImplementation(() => {
            mockRecorderInstance = {
                startRecording: vi.fn(),
                recordMessage: vi.fn(),
                stopRecording: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
                getIsRecording: vi.fn().mockReturnValue(true)
            };
            return mockRecorderInstance;
        }),
        DemoPlaybackController: vi.fn().mockImplementation(() => ({
            setHandler: vi.fn(),
            loadDemo: vi.fn(),
            setSpeed: vi.fn(),
            setFrameDuration: vi.fn(),
            getCurrentTime: vi.fn(),
            getDuration: vi.fn(),
            getState: vi.fn(),
            getSpeed: vi.fn(),
            play: vi.fn(),
            pause: vi.fn(),
            stop: vi.fn()
        })),
        ClientRenderer: vi.fn(),
        createEmptyEntityState: vi.fn().mockReturnValue({ origin: {x:0,y:0,z:0} })
    };
});

vi.mock('../../src/net/connection.js', () => ({
    MultiplayerConnection: vi.fn().mockImplementation(() => {
        mockMultiplayerInstance = {
            setDemoRecorder: vi.fn(),
            setPrediction: vi.fn(),
            isConnected: vi.fn().mockReturnValue(true),
            disconnect: vi.fn(),
            sendCommand: vi.fn()
        };
        return mockMultiplayerInstance;
    })
}));

vi.mock('../../src/ui/menu/system.js', () => ({
    MenuSystem: vi.fn().mockImplementation(() => ({
        isActive: vi.fn(),
        pushMenu: vi.fn(),
        closeAll: vi.fn(),
        render: vi.fn(),
        handleInput: vi.fn(),
        getState: vi.fn().mockReturnValue({})
    }))
}));

vi.mock('../../src/hud.js', () => ({
    Init_Hud: vi.fn().mockResolvedValue(undefined),
    Draw_Hud: vi.fn()
}));

vi.mock('@quake2ts/cgame', async () => {
  return {
    ClientPrediction: vi.fn().mockImplementation(() => ({})),
    interpolatePredictionState: vi.fn(),
    ViewEffects: vi.fn().mockImplementation(() => ({})),
    GetCGameAPI: vi.fn().mockReturnValue({
        Init: vi.fn(),
        Shutdown: vi.fn(),
        DrawHUD: vi.fn()
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

        mockEngine = {
            trace: vi.fn().mockReturnValue({ fraction: 1.0 }),
            assets: {
                listFiles: vi.fn().mockReturnValue([])
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
                end2D: vi.fn()
            },
            cmd: {
                executeText: vi.fn(),
                register: vi.fn()
            }
        };

        const imports: ClientImports = {
            engine: mockEngine,
            host: {
                cvars: {
                    get: vi.fn().mockReturnValue({ string: '' }),
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
        expect(mockMultiplayerInstance).toBeDefined();
        expect(mockMultiplayerInstance.setDemoRecorder).toHaveBeenCalled();
        // Check argument is the recorder instance
        expect(mockMultiplayerInstance.setDemoRecorder).toHaveBeenCalledWith(mockRecorderInstance);
    });

    it('should start recording when connected', () => {
        client.startRecording('my_demo.dm2');

        expect(mockRecorderInstance.startRecording).toHaveBeenCalledWith('my_demo.dm2');
    });

    it('should not start recording when not connected', () => {
        mockMultiplayerInstance.isConnected.mockReturnValue(false);

        client.startRecording('my_demo.dm2');

        expect(mockRecorderInstance.startRecording).not.toHaveBeenCalled();
    });

    it('should stop recording and handle data', () => {
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
            body: mockBody
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
