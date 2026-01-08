import {
  PlayerClient,
  createPlayerInventory,
  createPlayerWeaponStates
} from '@quake2ts/game';

/**
 * Creates a default PlayerClient object with optional overrides.
 * Includes inventory, weapon states, and persistent state.
 *
 * @param overrides - Partial PlayerClient to override defaults.
 * @returns A complete PlayerClient object.
 */
export const createPlayerClientFactory = (overrides?: Partial<PlayerClient>): PlayerClient => {
    return {
        inventory: createPlayerInventory(),
        weaponStates: createPlayerWeaponStates(),
        buttons: 0,
        pm_type: 0,
        pm_time: 0,
        pm_flags: 0,
        gun_frame: 0,
        rdflags: 0,
        fov: 90,
        pers: {
            connected: true,
            inventory: [],
            health: 100,
            max_health: 100,
            savedFlags: 0,
            selected_item: 0
        },
        ...overrides,
    };
};
