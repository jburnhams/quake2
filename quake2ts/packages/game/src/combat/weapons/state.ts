// =================================================================
// Quake II - Weapon State Machine
// =================================================================

import { WeaponId } from '../../inventory/playerInventory.js';

export enum WeaponStateEnum {
    WEAPON_READY,      // Idle, can fire or switch
    WEAPON_ACTIVATING, // Raising/drawing weapon
    WEAPON_DROPPING,   // Lowering weapon
    WEAPON_FIRING      // Currently firing
}

export interface WeaponState {
    lastFireTime: number;
    spinupCount?: number; // For Chaingun spin-up
    grenadeTimer?: number; // For Hand Grenade cooking start time
    heat?: number; // For heat-based weapons (Hyperblaster Alt)
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
