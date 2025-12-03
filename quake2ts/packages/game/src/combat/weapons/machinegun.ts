// =================================================================
// Quake II - Machinegun Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Repeating } from './animation.js';
import { fireMachinegun } from './firing.js';
import { NoAmmoWeaponChange } from './switching.js';
import { BUTTON_ATTACK } from '../../buttons.js';
import { AmmoType } from '../../inventory/ammo.js';

// Machinegun Frames (Internal to logic)
const FRAME_MACHINEGUN_ACTIVATE_LAST = 3;
const FRAME_MACHINEGUN_FIRE_LAST = 5;
const FRAME_MACHINEGUN_IDLE_LAST = 45;
const FRAME_MACHINEGUN_DEACTIVATE_LAST = 49;

function machinegunFire(ent: Entity, sys: EntitySystem) {
    if (!ent.client) return;
    const client = ent.client;

    if (!(client.buttons & BUTTON_ATTACK)) {
        // Stop firing
        // ent.client.machinegun_shots = 0; // if tracked
        client.gun_frame = 6; // Go to idle
        return;
    }

    if (client.gun_frame === 4) {
        client.gun_frame = 5;
    } else {
        client.gun_frame = 4;
    }

    if (client.inventory.ammo.counts[AmmoType.Bullets] < 1) {
        client.gun_frame = 6;
        NoAmmoWeaponChange(ent);
        return;
    }

    fireMachinegun(sys.game, ent);
}

export function machinegunThink(player: Entity, sys: EntitySystem) {
    Weapon_Repeating(
        player,
        FRAME_MACHINEGUN_ACTIVATE_LAST + 1, // FIRE_FRAME (4)
        FRAME_MACHINEGUN_FIRE_LAST, // 5
        FRAME_MACHINEGUN_IDLE_LAST,
        FRAME_MACHINEGUN_DEACTIVATE_LAST,
        0,
        (ent) => machinegunFire(ent, sys),
        sys
    );
}
