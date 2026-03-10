import { vi, Mock } from 'vitest';
import { createMockGameExports } from '../../game/helpers.js';

export interface MockFsPromises {
    default: {
        readFile: Mock;
    };
    readFile: Mock;
}

/**
 * Common mock for node:fs/promises used by server tests
 */
export function createMockFsPromises(): MockFsPromises {
    return {
        default: {
            readFile: vi.fn().mockResolvedValue(Buffer.from([0]))
        },
        readFile: vi.fn().mockResolvedValue(Buffer.from([0]))
    };
}

export interface MockEngineParseBsp {
    parseBsp: Mock;
}

/**
 * Common mock for @quake2ts/engine used by server tests
 */
export function createMockEngineParseBsp(): MockEngineParseBsp {
    return {
        parseBsp: vi.fn().mockReturnValue({
            planes: [],
            nodes: [],
            leafs: [],
            brushes: [],
            models: [],
            leafLists: { leafBrushes: [] },
            texInfo: [],
            brushSides: [],
            visibility: { numClusters: 0, clusters: [] }
        })
    };
}

/**
 * Common mock for @quake2ts/game used by server tests
 */
export function createMockGameModule(actual?: any): any {
    return {
        ...(actual || {}),
        createGame: vi.fn().mockReturnValue(createMockGameExports()),
        createPlayerInventory: vi.fn().mockReturnValue({
             ammo: { counts: [] },
             items: new Set(),
             ownedWeapons: new Set(),
             powerups: new Map()
        }),
        createPlayerWeaponStates: vi.fn().mockReturnValue({})
    };
}
