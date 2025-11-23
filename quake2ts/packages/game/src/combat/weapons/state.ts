// =================================================================
// Quake II - Weapon State Machine
// =================================================================

import { WeaponId } from '../../inventory/playerInventory.js';

export interface WeaponState {
    lastFireTime: number;
    shots?: number; // For Chaingun spin-up/flash cycling
}

export interface PlayerWeaponStates {
    states: Map<WeaponId, WeaponState>;
}

export function createPlayerWeaponStates(): PlayerWeaponStates {
    return {
        states: new Map(),
    };
}

export function getWeaponState(playerStates: PlayerWeaponStates, weaponId: WeaponId): WeaponState {
    let state = playerStates.states.get(weaponId);
    if (!state) {
        state = { lastFireTime: 0 };
        playerStates.states.set(weaponId, state);
    }
    return state;
}
