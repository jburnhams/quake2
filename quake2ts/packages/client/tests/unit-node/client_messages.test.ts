import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '@quake2ts/client/index.js';
import * as CGame from '@quake2ts/cgame';
import {
    createMockEngineImports,
    createMockEngineHost,
    createMockCGameAPI
} from '@quake2ts/test-utils';

// Mock dependencies
vi.mock('@quake2ts/cgame', async () => {
    const utils = await vi.importActual<typeof import('@quake2ts/test-utils')>('@quake2ts/test-utils');
    return {
        GetCGameAPI: vi.fn(() => utils.createMockCGameAPI()),
        ClientPrediction: utils.MockClientPrediction,
        ViewEffects: utils.MockViewEffects,
        createCGameImport: vi.fn(),
    };
});

vi.mock('@quake2ts/engine', async () => {
    const utils = await vi.importActual<typeof import('@quake2ts/test-utils')>('@quake2ts/test-utils');
    return {
        EngineHost: utils.MockEngineHost,
        DemoPlaybackController: utils.MockDemoPlaybackController,
        Renderer: utils.MockRenderer,
        DynamicLightManager: utils.MockDynamicLightManager,
        DemoRecorder: utils.MockDemoRecorder,
        ClientNetworkHandler: utils.MockClientNetworkHandler,
        createEmptyEntityState: utils.mockCreateEmptyEntityState,
    };
});

vi.mock('@quake2ts/client/ui/menu/system.js', async () => {
    const utils = await vi.importActual<typeof import('@quake2ts/test-utils')>('@quake2ts/test-utils');
    return {
        MenuSystem: utils.MockMenuSystem
    };
});

describe('ClientExports Message Parsing', () => {
    let client: ClientExports;
    let mockCg: any;
    let mockImports: ClientImports;

    beforeEach(() => {
        // Mock localStorage
        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            length: 0,
            key: vi.fn(),
        } as any;

        // Setup CGame mock return
        mockCg = createMockCGameAPI();
        vi.mocked(CGame.GetCGameAPI).mockReturnValue(mockCg);

        mockImports = {
            engine: createMockEngineImports({
                cmd: { executeText: vi.fn() }
            }),
            host: createMockEngineHost()
        } as ClientImports;

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
