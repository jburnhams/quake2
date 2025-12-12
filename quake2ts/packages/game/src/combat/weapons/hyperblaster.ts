// =================================================================
// Quake II - HyperBlaster Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Repeating } from './animation.js';
import { fireHyperBlaster, fireHyperBlasterBeam } from './firing.js';
import { getWeaponState, WeaponStateEnum } from './state.js';
import { WeaponId } from '../../inventory/playerInventory.js';
import {
    FRAME_HYPERBLASTER_ACTIVATE_LAST,
    FRAME_HYPERBLASTER_FIRE_FRAME,
    FRAME_HYPERBLASTER_FIRE_LAST,
    FRAME_HYPERBLASTER_IDLE_LAST,
    FRAME_HYPERBLASTER_DEACTIVATE_LAST
} from './frames.js';

export function hyperBlasterThink(player: Entity, sys: EntitySystem) {
    const weaponState = player.client ? getWeaponState(player.client.weaponStates, WeaponId.HyperBlaster) : null;

    // Decay heat
    if (weaponState && (weaponState.heat || 0) > 0) {
        const isFiringBeam = player.client && (player.client.buttons & 32);
        if (!isFiringBeam && sys.timeSeconds > weaponState.lastFireTime + 0.5) {
             weaponState.heat! -= 1;
             if (weaponState.heat! < 0) weaponState.heat = 0;
        }
    }

    // Check for Attack2 start (Guided/Beam Mode)
    // 32 = Attack2
    if (player.client && player.client.weaponstate === WeaponStateEnum.WEAPON_READY) {
        if (player.client.buttons & 32) {
             player.client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
             player.client.gun_frame = FRAME_HYPERBLASTER_ACTIVATE_LAST + 1;
        }
    }

    Weapon_Repeating(
        player,
        FRAME_HYPERBLASTER_ACTIVATE_LAST,
        FRAME_HYPERBLASTER_FIRE_LAST,
        FRAME_HYPERBLASTER_IDLE_LAST,
        FRAME_HYPERBLASTER_DEACTIVATE_LAST,
        null, // No pause frames
        (ent) => {
            if (ent.client && (ent.client.buttons & 32) && weaponState) {
                fireHyperBlasterBeam(sys.game, ent, weaponState);
            } else {
                fireHyperBlaster(sys.game, ent);
            }
        },
        sys
    );
}
