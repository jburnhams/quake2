import { Entity, LevelState, LevelFrameState } from '@quake2ts/game';
import type { GameSaveFile } from '@quake2ts/game';
import { TestContext } from '../helpers.js';
import { Vec3 } from '@quake2ts/shared';

/**
 * Interface for a mock save game object.
 */
export interface MockSaveGame {
    game: GameSaveFile;
    entities: any[]; // Serialized entities
    client: any; // Serialized client
    level: LevelState;
    timestamp: number;
}

/**
 * Creates a mock SaveGame object.
 *
 * @param overrides - Optional overrides for save game properties.
 * @returns A MockSaveGame object.
 */
export function createMockSaveGame(overrides?: Partial<MockSaveGame>): MockSaveGame {
    const defaultLevelState: LevelFrameState = {
        frameNumber: 100,
        timeSeconds: 10.0,
        previousTimeSeconds: 9.9,
        deltaSeconds: 0.1
    };

    const defaultLevel: LevelState = {
        next_auto_save: 0,
        health_bar_entities: [null, null, null, null],
        intermission_angle: { x: 0, y: 0, z: 0 },
        intermission_origin: { x: 0, y: 0, z: 0 },
        helpmessage1: "",
        helpmessage2: "",
        help1changed: 0,
        help2changed: 0,
        mapname: 'test_map'
    };

    const defaultGame: GameSaveFile = {
        version: 2,
        timestamp: Date.now(),
        map: 'test_map',
        difficulty: 1,
        playtimeSeconds: 100,
        level: defaultLevelState,
        entities: {
            timeSeconds: 10.0,
            pool: { capacity: 1024, activeOrder: [], freeList: [], pendingFree: [] },
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
            level: defaultLevel
        },
        rng: { mt: { index: 0, state: [] } },
        gameState: {},
        cvars: [],
        configstrings: []
    };

    return {
        game: overrides?.game ?? defaultGame,
        entities: overrides?.entities ?? [],
        client: overrides?.client ?? {},
        level: overrides?.level ?? defaultLevel,
        timestamp: overrides?.timestamp ?? Date.now()
    };
}

/**
 * Captures the current test context state as a save game snapshot.
 * Note: This is a simplified snapshot for testing, not a full serialization.
 *
 * @param context - The test context to snapshot.
 * @returns A MockSaveGame representing the current state.
 */
export function createSaveGameSnapshot(context: TestContext): MockSaveGame {
    const entities: any[] = [];
    context.entities.forEachEntity((ent: Entity) => {
        if (!ent.inUse) return;
        // Simple serialization of essential fields
        entities.push({
            classname: ent.classname,
            origin: { ...ent.origin },
            angles: { ...ent.angles },
            health: ent.health,
            spawnflags: ent.spawnflags,
            targetname: ent.targetname
        });
    });

    // We need to construct a LevelFrameState for the save file
    const levelFrameState: LevelFrameState = {
        frameNumber: (context.game as any).level?.frameNumber ?? 0,
        timeSeconds: (context.game as any).level?.timeSeconds ?? (context.game as any).time ?? 0,
        previousTimeSeconds: 0,
        deltaSeconds: 0.1
    };

    const currentLevel = (context.entities as any).level || {};

    return {
        game: {
            version: 2,
            timestamp: Date.now(),
            map: 'snapshot_map',
            difficulty: 0,
            playtimeSeconds: (context.game as any).time ?? 0,
            level: levelFrameState,
            entities: context.entities.createSnapshot(),
            rng: { mt: { index: 0, state: [] } },
            gameState: {},
            cvars: [],
            configstrings: []
        },
        entities,
        client: {},
        level: currentLevel as LevelState,
        timestamp: Date.now()
    };
}

/**
 * Restores a test context from a save game snapshot.
 *
 * @param saveGame - The save game to restore.
 * @param context - The test context to update.
 */
export function restoreSaveGameSnapshot(saveGame: MockSaveGame, context: TestContext): void {
    // Clear existing entities (except world/clients if needed, but for test usually clear all)
    // Assuming context.entities has a way to reset or we just free all
    // context.entities.reset() // if available

    // Re-spawn entities
    saveGame.entities.forEach(entData => {
        const ent = context.entities.spawn();
        ent.classname = entData.classname;
        ent.origin = { ...entData.origin };
        ent.angles = { ...entData.angles };
        ent.health = entData.health;
        ent.spawnflags = entData.spawnflags;
        ent.targetname = entData.targetname;
        context.entities.linkentity(ent);
    });

    // Restore level state
    if ((context.entities as any).level) {
        Object.assign((context.entities as any).level, saveGame.level);
    }
}

/**
 * Result of comparing two save games.
 */
export interface SaveGameDiff {
    entityCountDiff: number;
    differentEntities: { index: number, field: string, expected: any, actual: any }[];
    gameStateDiffs: string[];
}

/**
 * Compares two save games and returns the differences.
 * Useful for testing save/load determinism.
 *
 * @param a - First save game.
 * @param b - Second save game.
 * @returns A SaveGameDiff object.
 */
export function compareSaveGames(a: MockSaveGame, b: MockSaveGame): SaveGameDiff {
    const diffs: SaveGameDiff = {
        entityCountDiff: a.entities.length - b.entities.length,
        differentEntities: [],
        gameStateDiffs: []
    };

    // Compare game state
    const aTime = a.game.level.timeSeconds;
    const bTime = b.game.level.timeSeconds;
    if (aTime !== bTime) diffs.gameStateDiffs.push(`time: ${aTime} vs ${bTime}`);

    const aFrame = a.game.level.frameNumber;
    const bFrame = b.game.level.frameNumber;
    if (aFrame !== bFrame) diffs.gameStateDiffs.push(`framenum: ${aFrame} vs ${bFrame}`);

    // Compare entities (naive index matching)
    const count = Math.min(a.entities.length, b.entities.length);
    for (let i = 0; i < count; i++) {
        const entA = a.entities[i];
        const entB = b.entities[i];

        if (entA.classname !== entB.classname) {
            diffs.differentEntities.push({ index: i, field: 'classname', expected: entA.classname, actual: entB.classname });
        }
        if (entA.health !== entB.health) {
            diffs.differentEntities.push({ index: i, field: 'health', expected: entA.health, actual: entB.health });
        }
        // Vector checks
        if (!vec3Equals(entA.origin, entB.origin)) {
            diffs.differentEntities.push({ index: i, field: 'origin', expected: entA.origin, actual: entB.origin });
        }
    }

    return diffs;
}

function vec3Equals(a: Vec3, b: Vec3, epsilon = 0.001): boolean {
    return Math.abs(a.x - b.x) < epsilon &&
           Math.abs(a.y - b.y) < epsilon &&
           Math.abs(a.z - b.z) < epsilon;
}
