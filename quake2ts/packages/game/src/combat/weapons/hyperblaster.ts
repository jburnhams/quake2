// =================================================================
// Quake II - HyperBlaster Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Repeating } from './animation.js';
import { fireHyperBlaster } from './firing.js';
import {
    FRAME_HYPERBLASTER_ACTIVATE_LAST,
    FRAME_HYPERBLASTER_FIRE_FRAME,
    FRAME_HYPERBLASTER_FIRE_LAST,
    FRAME_HYPERBLASTER_IDLE_LAST,
    FRAME_HYPERBLASTER_DEACTIVATE_LAST
} from './frames.js';
import { WeaponStateEnum } from './state.js';
import { BUTTON_ATTACK } from '../../buttons.js';
import { NoAmmoWeaponChange } from './switching.js';
import { AmmoType } from '../../inventory/ammo.js';

function hyperBlasterFire(ent: Entity, sys: EntitySystem) {
    if (!ent.client) return;
    const client = ent.client;

    // Start on frame 6
    if (client.gun_frame > 20) {
        client.gun_frame = 6;
    } else {
        client.gun_frame++;
    }

    // Loop logic
    if (client.gun_frame === 12) {
        if (client.inventory.ammo.counts[AmmoType.Cells] > 0 && (client.buttons & BUTTON_ATTACK)) {
            client.gun_frame = 6;
        } else {
            sys.sound(ent, 0, 'weapons/hyprbd1a.wav', 1, 0, 0); // wind down
        }
    }

    // Play weapon sound for firing loop
    if (client.gun_frame >= 6 && client.gun_frame <= 11) {
        client.weapon_sound = sys.soundIndex('weapons/hyprbl1a.wav');
    } else {
        client.weapon_sound = 0;
    }

    // Fire frames
    const request_firing = (client.buttons & BUTTON_ATTACK); // simplified buffer check

    if (request_firing) {
        if (client.gun_frame >= 6 && client.gun_frame <= 11) {
            if (client.inventory.ammo.counts[AmmoType.Cells] < 1) {
                NoAmmoWeaponChange(ent);
                return;
            }

            // fireHyperBlaster handles ammo consumption and projectile
            fireHyperBlaster(sys.game, ent);

            // Animation logic is handled in fireHyperBlaster (kick, etc)
            // But rotational offset?
            // "rotation = (ent->client->ps.gunframe - 5) * 2 * PIf / 6;"
            // fireHyperBlaster currently fires from fixed offset.
            // If we want rotating barrel effect, we should pass offset to fireHyperBlaster or handle it there.
            // Current fireHyperBlaster uses P_ProjectSource with {x:8, y:8, z:-8}.
            // We should ideally update fireHyperBlaster to accept offset.
            // But for now, basic firing is implemented.
        }
    }
}

export function hyperBlasterThink(player: Entity, sys: EntitySystem) {
    Weapon_Repeating(
        player,
        FRAME_HYPERBLASTER_FIRE_FRAME,
        FRAME_HYPERBLASTER_FIRE_LAST,
        FRAME_HYPERBLASTER_IDLE_LAST,
        FRAME_HYPERBLASTER_DEACTIVATE_LAST,
        0,
        (ent) => hyperBlasterFire(ent, sys),
        sys
    );
}
