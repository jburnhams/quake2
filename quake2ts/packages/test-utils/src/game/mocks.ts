import { Entity, GameExports, GameImports } from '@quake2ts/game';
import { vi } from 'vitest';

/**
 * Interface for mock GameState.
 */
export interface GameState {
    levelName: string;
    time: number;
    entities: Entity[];
    clients: any[]; // Mock client objects
}

/**
 * Creates a mock game state object.
 * @param overrides Optional overrides for the game state.
 */
export function createMockGameState(overrides?: Partial<GameState>): GameState {
    return {
        levelName: 'test_level',
        time: 0,
        entities: [],
        clients: [],
        ...overrides
    };
}

/**
 * Creates a mock GameExports object.
 */
export function createMockGameExports(overrides?: Partial<GameExports>): GameExports {
    return {
        init: vi.fn(),
        shutdown: vi.fn(),
        spawnWorld: vi.fn(),
        frame: vi.fn().mockReturnValue({ state: {} }),
        clientConnect: vi.fn().mockReturnValue(true),
        clientBegin: vi.fn().mockReturnValue({ index: 1, origin: { x: 0, y: 0, z: 0 } }),
        clientDisconnect: vi.fn(),
        clientThink: vi.fn(),
        respawn: vi.fn(),
        entities: {
            getByIndex: vi.fn(),
            forEachEntity: vi.fn(),
            findByRadius: vi.fn(),
            find: vi.fn(),
            checkAnyCollision: vi.fn(),
            trace: vi.fn(),
            pointcontents: vi.fn(),
            link: vi.fn(),
            unlink: vi.fn(),
            spawn: vi.fn(),
            free: vi.fn(),
            activeCount: 0,
            world: { classname: 'worldspawn' } as any,
        } as any,
        multicast: vi.fn(),
        unicast: vi.fn(),
        configstring: vi.fn(),
        serverCommand: vi.fn(),
        sound: vi.fn(),
        soundIndex: vi.fn(),
        centerprintf: vi.fn(),
        trace: vi.fn(),
        time: 0,
        deathmatch: false,
        skill: 1,
        rogue: false,
        xatrix: false,
        coop: false,
        friendlyFire: false,
        random: {
             next: vi.fn(),
             nextFloat: vi.fn(),
             range: vi.fn(),
             crandom: vi.fn(),
             getState: vi.fn(),
             setState: vi.fn()
        } as any,
        createSave: vi.fn(),
        loadSave: vi.fn(),
        serialize: vi.fn(),
        loadState: vi.fn(),
        setGodMode: vi.fn(),
        setNoclip: vi.fn(),
        setNotarget: vi.fn(),
        giveItem: vi.fn(),
        damage: vi.fn(),
        teleport: vi.fn(),
        registerHooks: vi.fn(),
        hooks: {
            onMapLoad: vi.fn(),
            onMapUnload: vi.fn(),
            onPlayerSpawn: vi.fn(),
            onPlayerDeath: vi.fn(),
            register: vi.fn(),
            onPickup: vi.fn(), // Added onPickup mock
        } as any,
        setSpectator: vi.fn(),
        registerEntitySpawn: vi.fn(),
        unregisterEntitySpawn: vi.fn(),
        getCustomEntities: vi.fn(),
        ...overrides
    };
}
