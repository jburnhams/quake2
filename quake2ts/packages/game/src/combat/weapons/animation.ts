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
            client.gun_frame = FRAME_FIRE_LAST + 1 - (FRAME_FIRE_LAST - FRAME_ACTIVATE_LAST); // This seems wrong based on arg names.
            // Usually Fire Frames are immediately after Activate or Idle?
            // Re-reading logic.
            // In Q2:
            // FRAME_ACTIVATE_LAST is end of activate.
            // FRAME_FIRE_LAST is end of fire.
            // Fire frames usually start at FRAME_ACTIVATE_LAST + 1? No.
            // The arguments are LAST frames of each sequence.

            // Wait, let's look at standard structure.
            // Activate: 0..FRAME_ACTIVATE_LAST
            // Wait: FRAME_WAIT
            // Fire: FRAME_WAIT+1..FRAME_FIRE_LAST
            // Idle: FRAME_FIRE_LAST+1..FRAME_IDLE_LAST
            // Deactivate: FRAME_IDLE_LAST+1..FRAME_DEACTIVATE_LAST

            // Actually, arguments are usually ranges.
            // Let's use Q2 generic args:
            // (ent, FRAME_ACTIVATE_LAST, FRAME_FIRE_LAST, FRAME_IDLE_LAST, FRAME_DEACTIVATE_LAST, FRAME_WAIT, FRAME_NOOP, fire)

            // If FIRE, start at FRAME_ACTIVATE_LAST + 1 ?
            // Usually the fire sequence starts after Activate.
            client.gun_frame = FRAME_ACTIVATE_LAST + 1;
            // But we need to handle "WAIT" frame?
            // Q2 logic:
            // if ( ((ent->client->latched_buttons|ent->client->buttons) & BUTTON_ATTACK) )
            // {
            //      ent->client->latched_buttons &= ~BUTTON_ATTACK;
            //      if ((!ent->client->ammo_index) ||
            //          ( ent->client->pers.inventory[ent->client->ammo_index] >= ent->client->pers.weapon->quantity))
            //      {
            //          ent->client->ps.gunframe = FRAME_ACTIVATE_LAST+1;
            //          ent->client->weaponstate = WEAPON_FIRING;
            //
            //          // start the animation
            //          ent->client->ps.gunframe = FRAME_ACTIVATE_LAST+1;
            //      }
            // }
            // So yes, starts at FRAME_ACTIVATE_LAST + 1.
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
        // Fire logic
        // for (n=0; n<FIRE_DURATION; n++)
        // {
        //    ent->client->ps.gunframe++;
        //    if (ent->client->ps.gunframe == FRAME_IDLE_LAST+1)
        //        ent->client->ps.gunframe = FRAME_ACTIVATE_LAST+1;
        //    ...

        // Wait, Weapon_Generic handles frame progression.
        // It calls 'fire' at specific frame?
        // No, 'fire' is passed as a callback.
        // In Q2, the fire function is usually called when the frame *is* the fire frame.
        // But Weapon_Generic logic in Q2 is:
        // if (ent->client->ps.gunframe == FRAME_FIRE_LAST)
        // {
        //      ent->client->weaponstate = WEAPON_READY;
        //      ent->client->ps.gunframe = FRAME_FIRE_LAST+1;
        //      return;
        // }
        //
        // ent->client->ps.gunframe++;

        // The fire function is called via:
        // if (ent->client->ps.gunframe == FRAME_WAIT && fire)
        //      fire (ent);

        // So FRAME_WAIT is the specific frame where the shot happens.

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

    // Update Grenade Timer (cooking)
    // If holding, we need to check if it blew up.
    // The cooking logic is usually inside the fire/think logic, but here we manage the animation state.

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

            // Start cook timer on first frame?
            // No, usually cook starts when we enter the firing sequence or hold frame.
            // Let's check logic:
            // "Frames 1-4: Prime animation"
            // "Frame 5 (FRAME_PRIME_SOUND): Play sound"
            // "Frame 11 (FRAME_THROW_HOLD): Hold frame"

            // We are just starting.
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
                // fire(ent, false); // Will happen on next frame check
            } else {
                // Still holding
                // Check cook timer
                if (!client.grenade_time) {
                    client.grenade_time = time + 3.0; // 3 seconds fuse
                    // Play loop sound?
                    // "Play primed loop sound 'weapons/hgrenc1b.wav' via weapon_sound"
                    // weapon_sound is usually an index/flag for the client to loop sound.
                    // We might need to set it on entity or client state.
                }

                if (time >= client.grenade_time) {
                    // Blew up in hand!
                    client.grenade_blew_up = true;
                    fire(ent, true); // Held = true (exploded)
                    // Transition to clean up or death handled by fire/damage
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
