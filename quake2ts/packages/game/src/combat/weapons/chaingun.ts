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
    FRAME_CHAINGUN_DEACTIVATE_LAST
} from './frames.js';

const CHAINGUN_PAUSE_FRAMES = [38, 43, 51, 61];

export function chaingunThink(player: Entity, sys: EntitySystem) {
    const weaponState = getWeaponState(player.client!.weaponStates, WeaponId.Chaingun);

    // Check for spin-down sound
    if (!(player.client!.buttons & BUTTON_ATTACK) && weaponState.spinupCount && weaponState.spinupCount > 0) {
        sys.sound(player, 0, 'weapons/chngnd1a.wav', 1, 0, 0);
        weaponState.spinupCount = 0;
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
