import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, GameSession } from '../src/session.js';
import { EngineImports, Renderer } from '@quake2ts/engine';
import { GameSaveFile } from '@quake2ts/game';

// Use vi.hoisted to create mock objects that can be used in vi.mock
const { mockGameExports, mockCreateGame, mockClientExports, mockCreateClient, mockEngineHost } = vi.hoisted(() => {
    const mockGameExports = {
        spawnWorld: vi.fn(),
        loadSave: vi.fn(),
    };

    const mockCreateGame = vi.fn().mockReturnValue(mockGameExports);

    const mockClientExports = {
        init: vi.fn(),
        render: vi.fn(),
        shutdown: vi.fn(),
        ParseCenterPrint: vi.fn(),
        ParseConfigString: vi.fn(),
    };

    const mockCreateClient = vi.fn().mockReturnValue(mockClientExports);

    const mockEngineHost = vi.fn(function(this: any) {
        this.start = vi.fn();
        this.stop = vi.fn();
        this.commands = {
            execute: vi.fn(),
            register: vi.fn()
        };
        this.cvars = {
            get: vi.fn(),
            register: vi.fn(),
            setValue: vi.fn()
        };
        this.paused = false;
    });

    return {
        mockGameExports,
        mockCreateGame,
        mockClientExports,
        mockCreateClient,
        mockEngineHost
    };
});

// Apply mocks before imports
vi.mock('@quake2ts/game', async () => {
    const actual = await vi.importActual('@quake2ts/game');
    return {
        ...actual,
        createGame: mockCreateGame,
    };
});

vi.mock('../src/index.js', async () => {
    const actual = await vi.importActual('../src/index.js');
    return {
        ...actual,
        createClient: mockCreateClient,
    };
});

vi.mock('@quake2ts/engine', async () => {
    const actual = await vi.importActual('@quake2ts/engine');
    return {
        ...actual,
        EngineHost: mockEngineHost,
    };
});

describe('GameSession', () => {
    let session: GameSession;
    let mockEngineImports: EngineImports & { renderer: Renderer; cmd?: { executeText(text: string): void } };

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock engine imports
        mockEngineImports = {
            trace: vi.fn().mockReturnValue({ allsolid: false, fraction: 1, endpos: { x: 0, y: 0, z: 0 }, planeNormal: { x: 0, y: 0, z: 1 } }),
            renderer: {} as Renderer,
            cmd: { executeText: vi.fn() },
            assets: {
                load: vi.fn(),
                get: vi.fn(),
            } as any,
        } as any;
    });

    it('should create a session with options', () => {
        session = createSession({ engine: mockEngineImports });
        expect(session).toBeDefined();
    });

    it('should start a new game', () => {
        session = createSession({ engine: mockEngineImports });
        session.startNewGame('base1', 2);

        expect(mockEngineImports.cmd!.executeText).toHaveBeenCalledWith('map base1');

        expect(mockCreateGame).toHaveBeenCalled();
        expect(mockCreateClient).toHaveBeenCalled();
        expect(mockEngineHost).toHaveBeenCalled();
    });

    it('should load a saved game', () => {
        session = createSession({ engine: mockEngineImports });
        const mockSaveData: GameSaveFile = {
            version: 2,
            timestamp: 12345,
            map: 'q2dm1',
            difficulty: 1,
            playtimeSeconds: 100,
            gameState: {},
            level: {} as any,
            rng: {} as any,
            entities: {} as any,
            cvars: [],
            configstrings: [],
        };

        session.loadSavedGame(mockSaveData);

        expect(mockEngineImports.cmd!.executeText).toHaveBeenCalledWith('map q2dm1');

        expect(mockGameExports.loadSave).toHaveBeenCalledWith(mockSaveData);
    });

    it('should shutdown properly', () => {
        session = createSession({ engine: mockEngineImports });
        session.startNewGame('base1');

        session.shutdown();

        expect(session.getGame()).toBeNull();
        expect(session.getClient()).toBeNull();
        expect(session.getHost()).toBeNull();
    });
});
