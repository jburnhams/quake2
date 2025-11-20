import type { Vec3 } from '@quake2ts/shared';
import type { Entity } from '../entities/entity.js';
import type { GameEngine } from '../index.js';

export const trace = (
    gameEngine: GameEngine,
    start: Vec3,
    end: Vec3,
    mins: Vec3,
    maxs: Vec3,
    passent: Entity | null,
    contentmask: number
) => {
    // TODO: trace against entities
    return gameEngine.trace(start, end, mins, maxs, passent, contentmask)
};
