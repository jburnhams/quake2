// =================================================================
// Quake II - CTF Flag State
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Vec3 } from '@quake2ts/shared';

export enum FlagState {
    AT_BASE = 0,
    CARRIED = 1,
    DROPPED = 2,
}

export interface FlagEntity extends Entity {
    flagState: FlagState;
    flagTeam: 'red' | 'blue';
    baseOrigin: Vec3; // Where to respawn/return
}

export function setFlagState(flag: FlagEntity, newState: FlagState, context: EntitySystem): void {
    flag.flagState = newState;

    // Logic for state changes could go here if needed
}
