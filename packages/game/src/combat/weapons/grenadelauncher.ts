// =================================================================
// Quake II - Grenade Launcher Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Generic } from './animation.js';
import { Weapon_AnimationTime } from './common.js';
import { fireGrenadeLauncher, firingRandom } from './firing.js';
import { WeaponStateEnum } from './state.js';
import {
    FRAME_GRENADELAUNCHER_ACTIVATE_LAST,
    FRAME_GRENADELAUNCHER_FIRE_LAST,
    FRAME_GRENADELAUNCHER_IDLE_LAST,
    FRAME_GRENADELAUNCHER_DEACTIVATE_LAST
} from './frames.js';

const GRENADELAUNCHER_PAUSE_FRAMES = [34, 51, 59];
// const GRENADELAUNCHER_FIRE_FRAMES = [6]; // Handled manually

export function grenadeLauncherThink(player: Entity, sys: EntitySystem) {
    if (!player.client) return;
    const client = player.client;
    const time = sys.timeSeconds;

    // Check if we need to think
    if ((client.weapon_think_time || 0) > time) {
        return;
    }

    if (client.weaponstate === WeaponStateEnum.WEAPON_READY) {
        // Ready Logic
        if ((client.buttons & 1) /* BUTTON_ATTACK */) {
            client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
            // Start at frame 6 (start of fire)
            client.gun_frame = FRAME_GRENADELAUNCHER_ACTIVATE_LAST + 1;
            // Record start time for charging
            client.weapon_charge_start_time = time;
            client.weapon_think_time = time + Weapon_AnimationTime(player);
            return;
        }

        // Idle animation
        if (client.gun_frame < FRAME_GRENADELAUNCHER_IDLE_LAST) {
            client.gun_frame++;
            client.weapon_think_time = time + Weapon_AnimationTime(player);

            // Pause frames (mimicking Weapon_Generic logic)
            if (GRENADELAUNCHER_PAUSE_FRAMES.includes(client.gun_frame)) {
                if (firingRandom.frandom() < 0.9375) {
                    return;
                }
            }
            return;
        }

        // Loop idle
        client.gun_frame = FRAME_GRENADELAUNCHER_FIRE_LAST + 1;
        client.weapon_think_time = time + Weapon_AnimationTime(player);
        return;
    }

    if (client.weaponstate === WeaponStateEnum.WEAPON_FIRING) {
        const fireFrame = FRAME_GRENADELAUNCHER_ACTIVATE_LAST + 1; // 6

        if (client.gun_frame === fireFrame) {
            // Charging Logic
            const chargeStart = client.weapon_charge_start_time || time;
            const heldTime = time - chargeStart;

            // Check if button still held
            if ((client.buttons & 1)) {
                // Still holding
                if (heldTime >= 3.0) {
                     // Force fire
                     fireGrenadeLauncher(sys.game, player, 3.0);
                     client.gun_frame++;
                     client.weapon_charge_start_time = undefined;
                } else {
                    // Continue holding
                    client.weapon_think_time = time + Weapon_AnimationTime(player);
                }
            } else {
                // Button released
                // Calculate timer
                let timer = heldTime;
                if (timer < 0.5) {
                     // Tap fire: Default behavior
                     fireGrenadeLauncher(sys.game, player);
                } else {
                    // Timed fire
                    if (timer < 1.0) timer = 1.0;
                    if (timer > 3.0) timer = 3.0;
                    fireGrenadeLauncher(sys.game, player, timer);
                }
                client.gun_frame++;
                client.weapon_charge_start_time = undefined;
            }
            client.weapon_think_time = time + Weapon_AnimationTime(player);
            return;
        }

        // Follow through animation
        if (client.gun_frame < FRAME_GRENADELAUNCHER_FIRE_LAST) {
            client.gun_frame++;
            client.weapon_think_time = time + Weapon_AnimationTime(player);
            return;
        }

        // Finished firing
        client.weaponstate = WeaponStateEnum.WEAPON_READY;
        client.gun_frame = FRAME_GRENADELAUNCHER_FIRE_LAST + 1; // Start idle
        client.weapon_think_time = time + Weapon_AnimationTime(player);
        return;
    }

    // Delegate other states (ACTIVATING, DROPPING) to generic
    Weapon_Generic(
        player,
        FRAME_GRENADELAUNCHER_ACTIVATE_LAST,
        FRAME_GRENADELAUNCHER_FIRE_LAST,
        FRAME_GRENADELAUNCHER_IDLE_LAST,
        FRAME_GRENADELAUNCHER_DEACTIVATE_LAST,
        GRENADELAUNCHER_PAUSE_FRAMES,
        null, // No fire callback, we handled it
        null as any, // fire callback ignored
        sys
    );
}
