import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, GameSession } from '@quake2ts/client/session';
import { createGame } from '@quake2ts/game';
import { createClient } from '@quake2ts/client/index';
import { EngineHost } from '@quake2ts/engine';

// Use real implementations for createGame and createClient to test integration
// But mock EngineHost to avoid starting an actual loop which might depend on time/animation frame
vi.mock('@quake2ts/engine', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        EngineHost: vi.fn(function(this: any, game: any, client: any) {
            this.start = vi.fn();
            this.stop = vi.fn();
            this.game = game;
            this.client = client;
        })
    };
});

describe('GameSession Integration', () => {
    let session: GameSession;
    let mockEngine: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockEngine = {
            trace: vi.fn(() => ({
                allsolid: false,
                startsolid: false,
                fraction: 1,
                endpos: { x: 0, y: 0, z: 0 },
                plane: null,
                surfaceFlags: 0,
                contents: 0,
                ent: null
            })),
            renderer: {
                width: 800,
                height: 600,
                begin2D: vi.fn(),
                end2D: vi.fn(),
            },
            assets: {
                listFiles: vi.fn(() => []),
            }
        };
    });

    it('should initialize game and client and link them via session', () => {
        session = createSession({ engine: mockEngine });
        session.startNewGame('base1', 1);

        const game = session.getGame();
        const client = session.getClient();
        const host = session.getHost();

        expect(game).toBeDefined();
        expect(client).toBeDefined();
        expect(host).toBeDefined();

        // Verify game state is initialized
        expect(game?.time).toBeDefined();

        // Verify client has access to engine
        expect(client?.configStrings).toBeDefined();
    });
});
