import {
  PlayerClient,
  createPlayerInventory,
  createPlayerWeaponStates
} from '@quake2ts/game';

export type FactoryOverrides<T> = Partial<T> & Record<string, any>;

/**
 * Creates a default PlayerClient object with optional overrides.
 * Includes inventory, weapon states, and persistent state.
 *
 * @param overrides - Partial PlayerClient to override defaults.
 * @returns A complete PlayerClient object.
 */
export const createPlayerClientFactory = (overrides?: FactoryOverrides<PlayerClient>): PlayerClient & Record<string, any> => {
    const client: PlayerClient = {
        inventory: createPlayerInventory(),
        weaponStates: createPlayerWeaponStates(),
        buttons: 0,
        pm_type: 0,
        pm_time: 0,
        pm_flags: 0,
        gun_frame: 0,
        rdflags: 0,
        fov: 90,
        kick_angles: { x: 0, y: 0, z: 0 },
        kick_origin: { x: 0, y: 0, z: 0 },
        pers: {
            connected: true,
            inventory: [],
            health: 100,
            max_health: 100,
            savedFlags: 0,
            selected_item: 0
        }
    };

    return { ...client, ...overrides } as PlayerClient & Record<string, any>;
};
