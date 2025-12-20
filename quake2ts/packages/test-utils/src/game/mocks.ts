import { Entity, GameExports, GameImports } from '@quake2ts/game';
import { vi } from 'vitest';

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
