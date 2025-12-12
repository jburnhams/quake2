// =================================================================
// Quake II - Chaingun Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { getWeaponState } from './state.js';
import { WeaponId } from '../../inventory/playerInventory.js';
import { BUTTON_ATTACK } from '../../buttons.js';
import { Weapon_Repeating } from './animation.js';
import { fireChaingun } from './firing.js';
import {
    FRAME_CHAINGUN_ACTIVATE_LAST,
    FRAME_CHAINGUN_FIRE_FRAME,
    FRAME_CHAINGUN_FIRE_LAST,
    FRAME_CHAINGUN_IDLE_LAST,
    FRAME_CHAINGUN_DEACTIVATE_LAST,
    FRAME_CHAINGUN_SPINUP
} from './frames.js';

const CHAINGUN_PAUSE_FRAMES = [38, 43, 51, 61];
const BUTTON_ATTACK2 = 32;

export function chaingunThink(player: Entity, sys: EntitySystem) {
    const weaponState = getWeaponState(player.client!.weaponStates, WeaponId.Chaingun);
    const client = player.client!;

    // Check for spin-down sound
    if (!(client.buttons & BUTTON_ATTACK) && !(client.buttons & BUTTON_ATTACK2) && weaponState.spinupCount && weaponState.spinupCount > 0) {
        sys.sound(player, 0, 'weapons/chngnd1a.wav', 1, 0, 0);
        weaponState.spinupCount = 0;
    }

    // Handle wind-up mode (Alt-Fire)
    if ((client.buttons & BUTTON_ATTACK2) && !(client.buttons & BUTTON_ATTACK)) {
        // Increment spinup count
        const spinupCount = (weaponState.spinupCount || 0) + 1;
        weaponState.spinupCount = spinupCount;

        // Use sys.game.time if available, otherwise fallback to sys.timeSeconds or mocks
        // sys.game might be undefined in some tests if they pass EntitySystem mock that doesn't have game
        // But typically sys.game should be present.
        const currentTime = sys.game ? sys.game.time : sys.timeSeconds * 1000;
        weaponState.lastFireTime = currentTime;

        // Play loop sound if spun up enough
        if (spinupCount > FRAME_CHAINGUN_SPINUP) {
             sys.sound(player, 0, "weapons/chngnl1a.wav", 1, 0, 0);
        } else {
             // Startup sound
             if (spinupCount === 1) {
                 sys.sound(player, 0, "weapons/chngnu1a.wav", 1, 0, 0);
             }
        }

        // Animate: Cycle frames 5-21 without firing
        if (client.gun_frame < FRAME_CHAINGUN_SPINUP || client.gun_frame > FRAME_CHAINGUN_FIRE_LAST) {
            client.gun_frame = FRAME_CHAINGUN_SPINUP;
        } else {
            client.gun_frame++;
            if (client.gun_frame > FRAME_CHAINGUN_FIRE_LAST) {
                client.gun_frame = FRAME_CHAINGUN_SPINUP;
            }
        }
        return;
    }

    Weapon_Repeating(
        player,
        FRAME_CHAINGUN_ACTIVATE_LAST,
        FRAME_CHAINGUN_FIRE_LAST,
        FRAME_CHAINGUN_IDLE_LAST,
        FRAME_CHAINGUN_DEACTIVATE_LAST,
        CHAINGUN_PAUSE_FRAMES,
        (ent) => fireChaingun(sys.game, ent),
        sys
    );
}
