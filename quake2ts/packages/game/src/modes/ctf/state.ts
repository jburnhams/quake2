// =================================================================
// Quake II - CTF Flag State
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';

export enum FlagState {
    AT_BASE = 0,
    CARRIED = 1,
    DROPPED = 2,
}

export interface FlagEntity extends Entity {
    flagState: FlagState;
    flagTeam: 'red' | 'blue';
    baseOrigin: [number, number, number]; // Where to respawn/return
}

export function setFlagState(flag: FlagEntity, newState: FlagState, context: EntitySystem): void {
    flag.flagState = newState;

    // Logic for state changes
    switch (newState) {
        case FlagState.AT_BASE:
            // Visible, at base position, solid, etc.
            break;
        case FlagState.CARRIED:
            // Hidden (or attached to player model), non-solid
            break;
        case FlagState.DROPPED:
            // Visible at drop location, solid, timeout enabled
            break;
    }
}
