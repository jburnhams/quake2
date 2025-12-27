import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '../src/index.js';
import * as CGame from '@quake2ts/cgame';

// Mock dependencies
vi.mock('@quake2ts/cgame', () => ({
    GetCGameAPI: vi.fn(() => ({
        Init: vi.fn(),
        Shutdown: vi.fn(),
        DrawHUD: vi.fn(),
        ParseCenterPrint: vi.fn(),
        NotifyMessage: vi.fn(),
        ParseConfigString: vi.fn(),
    })),
    ClientPrediction: class {
        constructor() {
            return {
                setAuthoritative: vi.fn(),
                getPredictedState: vi.fn(),
                enqueueCommand: vi.fn(),
                decayError: vi.fn()
            };
        }
    },
    ViewEffects: class {
        constructor() {
            return {
                render: vi.fn(),
                update: vi.fn()
            };
        }
    },
    createCGameImport: vi.fn(),
}));

vi.mock('@quake2ts/engine', () => ({
    EngineHost: class { constructor() {} },
    DemoPlaybackController: class {
        constructor() {
            return {
                setHandler: vi.fn(),
                setFrameDuration: vi.fn(),
                getCurrentTime: vi.fn(() => 0),
                update: vi.fn(),
                loadDemo: vi.fn()
            };
        }
    },
    Renderer: class { constructor() {} },
    DynamicLightManager: class {
        constructor() {
            return {
                update: vi.fn(),
                getActiveLights: vi.fn(() => [])
            };
        }
    },
    DemoRecorder: class {
        constructor() {
            return {
                startRecording: vi.fn(),
                stopRecording: vi.fn(),
                getIsRecording: vi.fn(() => false)
            };
        }
    },
    ClientNetworkHandler: class {
        constructor() {
            return {
                setView: vi.fn(),
                setCallbacks: vi.fn()
            };
        }
    }
}));

vi.mock('../src/ui/menu/system.js', () => ({
    MenuSystem: class {
        constructor() {
            return {
                onStateChange: undefined,
                isActive: vi.fn(() => false),
                closeAll: vi.fn(),
                pushMenu: vi.fn(),
                handleInput: vi.fn()
            };
        }
    }
}));

describe('ClientExports Message Parsing', () => {
    let client: ClientExports;
    let mockCg: any;
    let mockImports: ClientImports;

    beforeEach(() => {
        // Setup CGame mock return
        mockCg = {
            Init: vi.fn(),
            Shutdown: vi.fn(),
            DrawHUD: vi.fn(),
            ParseCenterPrint: vi.fn(),
            ParseConfigString: vi.fn(),
            NotifyMessage: vi.fn(),
        };
        (CGame.GetCGameAPI as any).mockReturnValue(mockCg);

        mockImports = {
            engine: {
                trace: vi.fn(() => ({})),
                renderer: {} as any,
                assets: {} as any,
                cmd: {} as any
            } as any,
            host: {
                cvars: {
                    get: vi.fn(),
                    list: vi.fn(() => []),
                    register: vi.fn(),
                    setValue: vi.fn(),
                },
                commands: {
                    register: vi.fn(),
                    execute: vi.fn(),
                }
            } as any
        };

        client = createClient(mockImports);
    });

    it('should fire onCenterPrint when ParseCenterPrint is called', () => {
        const handler = vi.fn();
        client.onCenterPrint = handler;

        client.ParseCenterPrint('Hello World');

        expect(mockCg.ParseCenterPrint).toHaveBeenCalledWith('Hello World', 0, false);
        expect(handler).toHaveBeenCalledWith('Hello World', 3.0);
    });

    it('should detect pickup messages in ParseCenterPrint', () => {
        const pickupHandler = vi.fn();
        client.onPickupMessage = pickupHandler;

        client.ParseCenterPrint('You got the Shotgun.');

        expect(pickupHandler).toHaveBeenCalledWith('Shotgun');
    });

    it('should fire onNotify when ParseNotify is called', () => {
        const handler = vi.fn();
        client.onNotify = handler;

        client.ParseNotify('Console message');

        expect(mockCg.NotifyMessage).toHaveBeenCalledWith(0, 'Console message', false);
        expect(handler).toHaveBeenCalledWith('Console message');
    });

    it('should detect obituary messages in ParseNotify', () => {
        const obituaryHandler = vi.fn();
        client.onObituaryMessage = obituaryHandler;

        // Obituaries
        client.ParseNotify('Player died');
        expect(obituaryHandler).toHaveBeenCalledWith('Player died');

        client.ParseNotify('Player was gunned down by Tank');
        expect(obituaryHandler).toHaveBeenCalledWith('Player was gunned down by Tank');
    });

    it('should filter chat messages from obituaries in ParseNotify', () => {
        const obituaryHandler = vi.fn();
        client.onObituaryMessage = obituaryHandler;

        // Chat message (usually has colon)
        client.ParseNotify('Player: Hello');
        expect(obituaryHandler).not.toHaveBeenCalled();

        client.ParseNotify('Server: Welcome');
        expect(obituaryHandler).not.toHaveBeenCalled();
    });
});
