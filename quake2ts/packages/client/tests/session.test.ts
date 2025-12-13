import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSession, GameSession, SessionOptions } from '../src/session.js';
import { GameSaveFile } from '@quake2ts/game';

describe('GameSession Save/Load', () => {
    let session: GameSession;
    let engineMock: any;

    beforeEach(() => {
        engineMock = {
            trace: vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } }),
            cmd: {
                executeText: vi.fn(),
            },
            renderer: {
                renderFrame: vi.fn(),
                width: 800,
                height: 600,
                begin2D: vi.fn(),
                end2D: vi.fn(),
                drawPic: vi.fn(),
                drawText: vi.fn(),
                measureText: vi.fn().mockReturnValue({ width: 0, height: 0 }),
                getPerformanceReport: vi.fn().mockReturnValue({}),
            }
        };

        const options: SessionOptions = {
            engine: engineMock,
            skill: 1,
            mapName: 'base1'
        };

        session = createSession(options);
    });

    afterEach(() => {
        if (session) {
            session.shutdown();
        }
    });

    const createMockSaveFile = (): GameSaveFile => ({
        version: 2,
        timestamp: 12345,
        map: 'base1',
        difficulty: 1,
        playtimeSeconds: 10,
        gameState: {
            health: 85
        },
        level: {
            frameNumber: 10,
            timeSeconds: 1.0,
            previousTimeSeconds: 0.9,
            deltaSeconds: 0.1
        },
        rng: {
             mt: { index: 0, state: new Array(624).fill(0) }
        },
        entities: {
            timeSeconds: 1.0,
            pool: {
                capacity: 1024,
                activeOrder: [],
                freeList: [],
                pendingFree: []
            },
            entities: [],
            thinks: [],
            awareness: {
                frameNumber: 0,
                sightEntityIndex: null,
                sightEntityFrame: 0,
                soundEntityIndex: null,
                soundEntityFrame: 0,
                sound2EntityIndex: null,
                sound2EntityFrame: 0,
                sightClientIndex: null
            },
            crossLevelFlags: 0,
            crossUnitFlags: 0,
            level: {
                next_auto_save: 0,
                health_bar_entities: [null, null, null, null],
                intermission_angle: { x: 0, y: 0, z: 0 },
                intermission_origin: { x: 0, y: 0, z: 0 },
                helpmessage1: "",
                helpmessage2: "",
                help1changed: 0,
                help2changed: 0
            }
        },
        cvars: [],
        configstrings: []
    });

    it('should report no quick save initially', () => {
        expect(session.hasQuickSave()).toBe(false);
    });

    it('should implement saveGame and return GameSaveFile', async () => {
        // Mock the internal game instance
        session.startNewGame('base1', 1);
        const game = session.getGame();

        const mockSaveFile = createMockSaveFile();

        // Spy on createSave
        vi.spyOn(game!, 'createSave').mockReturnValue(mockSaveFile);

        const save = await session.saveGame('slot1');
        expect(save).toBeDefined();
        expect(save.map).toBe('base1');
        expect(save.version).toBe(2);
    });

    it('should implement quickSave and hasQuickSave', async () => {
        session.startNewGame('base1', 1);
        const game = session.getGame();

        const mockSaveFile = createMockSaveFile();

        vi.spyOn(game!, 'createSave').mockReturnValue(mockSaveFile);

        await session.quickSave();
        expect(session.hasQuickSave()).toBe(true);
    });

    it('should implement quickLoad', async () => {
        session.startNewGame('base1', 1);
        const game = session.getGame();

        const mockSaveFile = createMockSaveFile();

        vi.spyOn(game!, 'createSave').mockReturnValue(mockSaveFile);

        await session.quickSave();

        const loadSpy = vi.spyOn(session, 'loadSavedGame');
        loadSpy.mockImplementation(() => {});

        await session.quickLoad();

        expect(loadSpy).toHaveBeenCalledWith(mockSaveFile);
    });

    it('should return correct metadata including player health', () => {
        const mockSaveFile = createMockSaveFile();
        mockSaveFile.map = 'q2dm1';
        mockSaveFile.difficulty = 2;
        mockSaveFile.playtimeSeconds = 300;
        mockSaveFile.timestamp = 123456789;

        const meta = session.getSaveMetadata(mockSaveFile);
        expect(meta.mapName).toBe('q2dm1');
        expect(meta.difficulty).toBe(2);
        expect(meta.playTime).toBe(300);
        expect(meta.timestamp).toBe(123456789);
        expect(meta.playerHealth).toBe(85);
    });
});
