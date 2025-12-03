// =================================================================
// Quake II - Chaingun Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Repeating } from './animation.js';
import { fireChaingun } from './firing.js';
import { BUTTON_ATTACK } from '../../buttons.js';
import { AmmoType } from '../../inventory/ammo.js';
import { getWeaponState } from './state.js';
import { WeaponId } from '../../inventory/playerInventory.js';

// Chaingun Frames
const FRAME_CHAINGUN_ACTIVATE_LAST = 4;
const FRAME_CHAINGUN_FIRE_FRAME = 5;
const FRAME_CHAINGUN_FIRE_LAST = 21;
const FRAME_CHAINGUN_IDLE_LAST = 52;
const FRAME_CHAINGUN_DEACTIVATE_LAST = 61;

function chaingunFire(ent: Entity, sys: EntitySystem) {
    if (!ent.client) return;
    const client = ent.client;

    if (client.gun_frame > 31) {
        client.gun_frame = 5;
        sys.sound(ent, 0, 'weapons/chngnu1a.wav', 1, 0, 0);
    } else if (client.gun_frame === 14 && !(client.buttons & BUTTON_ATTACK)) {
        client.gun_frame = 32;
        // weapon_sound = 0
        return;
    } else if (client.gun_frame === 21 && (client.buttons & BUTTON_ATTACK) && client.inventory.ammo.counts[AmmoType.Bullets] > 0) {
        client.gun_frame = 15;
    } else {
        client.gun_frame++;
    }

    if (client.gun_frame === 22) {
        // weapon_sound = 0
        sys.sound(ent, 0, 'weapons/chngnd1a.wav', 1, 0, 0);
        // Reset spinupCount for compatibility/tests
        const weaponState = getWeaponState(client.weaponStates, WeaponId.Chaingun);
        weaponState.spinupCount = 0;
    }

    if (client.gun_frame >= 5 && client.gun_frame <= 21) {
        // Play loop sound (handled by client/engine usually via weapon_sound, or we can play here)
        // ent.client.weapon_sound = ...

        fireChaingun(sys.game, ent);
    }
}

export function chaingunThink(player: Entity, sys: EntitySystem) {
    Weapon_Repeating(
        player,
        FRAME_CHAINGUN_FIRE_FRAME,
        FRAME_CHAINGUN_FIRE_LAST, // Note: Logic handles looping, this is just for generic activation
        FRAME_CHAINGUN_IDLE_LAST,
        FRAME_CHAINGUN_DEACTIVATE_LAST,
        0,
        (ent) => chaingunFire(ent, sys),
        sys
    );
}
