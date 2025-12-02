// =================================================================
// Quake II - Weapon Animation System
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { WeaponStateEnum, getWeaponState } from './state.js';
import { PowerupId } from '../../inventory/playerInventory.js';
import { GameExports } from '../../index.js';
import { WeaponId } from '../../inventory/playerInventory.js';
import { WEAPON_ITEMS } from '../../inventory/items.js';

/**
 * Calculates the animation time frame for weapons.
 * Handles powerups like Haste (doubles speed) and Quad Fire.
 *
 * Source: p_weapon.cpp (implicit in logic)
 */
export function Weapon_AnimationTime(ent: Entity): number {
    // Default 10Hz (0.1s)
    // Haste doubles weapon speed (halves time)
    // Quad Fire (Xatrix) quadruples weapon speed

    // In original:
    // if (is_quad) return 0.25 * 0.1;
    // if (is_haste) return 0.5 * 0.1;
    // return 0.1;

    let time = 0.1;

    if (ent.client?.inventory.powerups.has(PowerupId.TechHaste)) {
        time *= 0.5;
    }

    // Check for QuadFire (if implemented)
    if (ent.client?.inventory.powerups.has(PowerupId.QuadFire)) {
        time *= 0.25;
    }

    return time;
}

/**
 * Generic Weapon Animation Handler
 * Source: p_weapon.cpp:878-950
 */
export function Weapon_Generic(
    ent: Entity,
    FRAME_ACTIVATE_LAST: number,
    FRAME_FIRE_LAST: number,
    FRAME_IDLE_LAST: number,
    FRAME_DEACTIVATE_LAST: number,
    FRAME_WAIT: number,
    FRAME_NOOP: number,
    fire: (ent: Entity) => void,
    sys: EntitySystem
) {
    if (!ent.client) return;

    const client = ent.client;
    const time = sys.timeSeconds;

    // Advance animation
    if (client.weapon_think_time && client.weapon_think_time <= time) {
        client.weapon_think_time = 0;
    }

    if (client.weapon_think_time && client.weapon_think_time > time) {
        return;
    }

    if (client.weaponstate === WeaponStateEnum.WEAPON_ACTIVATING) {
        if (client.gun_frame < FRAME_ACTIVATE_LAST) {
            client.gun_frame++;
            client.weapon_think_time = time + Weapon_AnimationTime(ent);
            return;
        }
        client.weaponstate = WeaponStateEnum.WEAPON_READY;
        // Proceed to READY logic
    }

    if (client.weaponstate === WeaponStateEnum.WEAPON_DROPPING) {
        if (client.gun_frame < FRAME_DEACTIVATE_LAST) {
            client.gun_frame++;
            client.weapon_think_time = time + Weapon_AnimationTime(ent);
            return;
        }
        // Switch to new weapon
        // ChangeWeapon(ent); (Implemented in switching.ts)
        // For now, assume switch logic is called or handled elsewhere
        return;
    }

    if (client.weaponstate === WeaponStateEnum.WEAPON_READY) {
        // Check for fire
        if ((client.buttons & 1) /* BUTTON_ATTACK */) { // TODO: Check actual button constant
            client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
            // Start fire sequence at ACTIVATE_LAST + 1
            client.gun_frame = FRAME_ACTIVATE_LAST + 1;
            return;
        }

        // Idle animation
        if (client.gun_frame < FRAME_IDLE_LAST) {
            client.gun_frame++;
            // Pause frames logic (simplified for now)
            client.weapon_think_time = time + Weapon_AnimationTime(ent);
            return;
        }
        // Loop idle
        // Usually resets to FRAME_FIRE_LAST + 1
        client.gun_frame = FRAME_FIRE_LAST + 1;
        client.weapon_think_time = time + Weapon_AnimationTime(ent);
        return;
    }

    if (client.weaponstate === WeaponStateEnum.WEAPON_FIRING) {
        if (client.gun_frame < FRAME_FIRE_LAST) {
            client.gun_frame++;
            client.weapon_think_time = time + Weapon_AnimationTime(ent);
             if (client.gun_frame === FRAME_WAIT && fire) {
                fire(ent);
            }
            return;
        }

        // Finished firing
        client.weaponstate = WeaponStateEnum.WEAPON_READY;
        client.gun_frame = FRAME_FIRE_LAST + 1; // Start idle
        client.weapon_think_time = time + Weapon_AnimationTime(ent);
        return;
    }
}

/**
 * Weapon_Repeating - For automatic weapons (Chaingun, Hyperblaster)
 * Source: p_weapon.cpp:952-978
 */
export function Weapon_Repeating(
    ent: Entity,
    FRAME_FIRE_FRAME: number, // The frame where firing happens
    FRAME_FIRE_LAST: number,  // The last frame of firing sequence
    FRAME_IDLE_LAST: number,  // The last frame of idle sequence (used to reset)
    FRAME_PAUSE: number,      // Pause frames (not used in repeating logic usually)
    FRAME_NOOP: number,
    fire: (ent: Entity) => void,
    sys: EntitySystem
) {
    if (!ent.client) return;
    const client = ent.client;

    if (client.weaponstate === WeaponStateEnum.WEAPON_FIRING) {
        // Logic:
        // if ( (ent->client->ps.gunframe == fire_last) || (ent->client->ps.gunframe == idle_last) )
        //    ent->client->ps.gunframe = fire_frame;
        // else
        //    ent->client->ps.gunframe++;

        if (client.gun_frame === FRAME_FIRE_LAST || client.gun_frame === FRAME_IDLE_LAST) {
            client.gun_frame = FRAME_FIRE_FRAME;
        } else {
            client.gun_frame++;
        }

        if (client.gun_frame === FRAME_FIRE_FRAME && fire) {
            fire(ent);
        }

        // Check if button released
        if (!((client.buttons) & 1 /* BUTTON_ATTACK */)) {
            client.gun_frame = FRAME_IDLE_LAST + 1;
            client.weaponstate = WeaponStateEnum.WEAPON_READY;
        }
    } else {
        // Delegate to generic for activation/ready/dropping

        // Mapping arguments based on C source behavior:
        // ACTIVATE_LAST = FRAME_FIRE_FRAME - 1
        // FIRE_LAST = FRAME_FIRE_LAST
        // IDLE_LAST = FRAME_IDLE_LAST
        // DEACTIVATE_LAST = FRAME_PAUSE
        // WAIT = FRAME_NOOP

        Weapon_Generic(
            ent,
            FRAME_FIRE_FRAME - 1,
            FRAME_FIRE_LAST,
            FRAME_IDLE_LAST,
            FRAME_PAUSE,
            FRAME_NOOP,
            0,
            fire,
            sys
        );
    }
}

/**
 * Throw_Generic - For throwable weapons like Grenades
 * Source: p_weapon.cpp:1013-1213
 */
export function Throw_Generic(
    ent: Entity,
    FRAME_FIRE_LAST: number,
    FRAME_IDLE_LAST: number,
    FRAME_THROW_FIRST: number,
    FRAME_THROW_LAST: number,
    FRAME_PRIME_SOUND: number,
    FRAME_THROW_HOLD: number,
    FRAME_THROW_FIRE: number,
    fire: (ent: Entity, held: boolean) => void,
    sys: EntitySystem
) {
    if (!ent.client) return;
    const client = ent.client;
    const time = sys.timeSeconds;

    // Check if we need to think
    if ((client.weapon_think_time || 0) > time) {
        return;
    }
    client.weapon_think_time = time + 0.1; // Default 10Hz unless modified

    // WEAPON_READY: Can start throw
    if (client.weaponstate === WeaponStateEnum.WEAPON_READY) {
        if ((client.buttons & 1)) { // Attack button
            client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
            client.gun_frame = FRAME_THROW_FIRST;
            // Start cook logic in FIRING state
            return;
        }

        // Idle loop
        if (client.gun_frame < FRAME_IDLE_LAST) {
            client.gun_frame++;
            return;
        }
        client.gun_frame = FRAME_FIRE_LAST + 1; // Loop back to start of idle
        return;
    }

    if (client.weaponstate === WeaponStateEnum.WEAPON_FIRING) {
        if (client.gun_frame < FRAME_THROW_HOLD) {
            client.gun_frame++;

            if (client.gun_frame === FRAME_PRIME_SOUND) {
                sys.sound(ent, 0, 'weapons/hgrena1b.wav', 1, 1, 0);
            }
            return;
        }

        // We are at THROW_HOLD (Frame 11)
        if (client.gun_frame === FRAME_THROW_HOLD) {
            // Check if still holding button
            if (!(client.buttons & 1)) {
                // Button released, throw!
                client.gun_frame++; // Move to FRAME_THROW_FIRE
            } else {
                // Still holding
                // Check cook timer
                if (!client.grenade_time) {
                    client.grenade_time = time + 3.0; // 3 seconds fuse
                }

                if (time >= client.grenade_time) {
                    // Blew up in hand!
                    client.grenade_blew_up = true;
                    fire(ent, true); // Held = true (exploded)
                    client.weaponstate = WeaponStateEnum.WEAPON_READY; // Reset?
                    client.grenade_time = 0;
                }

                // Stay on hold frame
                return;
            }
        }

        // Frame 12: THROW_FIRE
        if (client.gun_frame === FRAME_THROW_FIRE) {
             if (!client.grenade_blew_up) {
                 fire(ent, false); // Throw!
             }
             client.gun_frame++;
             return;
        }

        // Follow through
        if (client.gun_frame < FRAME_THROW_LAST) {
            client.gun_frame++;
            return;
        }

        // Done
        client.weaponstate = WeaponStateEnum.WEAPON_READY;
        client.gun_frame = FRAME_FIRE_LAST + 1; // Go to idle
        client.grenade_time = 0;
        client.grenade_blew_up = false;
    }
}
