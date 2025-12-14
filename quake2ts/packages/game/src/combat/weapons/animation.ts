// =================================================================
// Quake II - Weapon Animation System
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { WeaponStateEnum } from './state.js';
import { PowerupId } from '../../inventory/playerInventory.js';
import { firingRandom } from './firing.js';
import { ChangeWeapon } from './switching.js';
import { Weapon_AnimationTime } from './common.js';

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
    pause_frames: number[] | null,
    fire_frames: number[] | null,
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
        client.gun_frame = FRAME_FIRE_LAST + 1; // Start idle (usually IDLE_FIRST)
        client.weapon_think_time = time + Weapon_AnimationTime(ent);
        return;
    }

    if (client.weaponstate === WeaponStateEnum.WEAPON_DROPPING) {
        if (client.gun_frame < FRAME_DEACTIVATE_LAST) {
            client.gun_frame++;
            client.weapon_think_time = time + Weapon_AnimationTime(ent);
            return;
        }
        // Switch to new weapon
        ChangeWeapon(ent);
        return;
    }

    if (client.weaponstate === WeaponStateEnum.WEAPON_READY) {
        // Check for fire (Primary or Alt-Fire)
        if ((client.buttons & 1) || (client.buttons & 32)) {
            client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
            // Start fire sequence at ACTIVATE_LAST + 1
            client.gun_frame = FRAME_ACTIVATE_LAST + 1;
            return;
        }

        // Check for pending switch
        if (client.newWeapon) {
            ChangeWeapon(ent, client.newWeapon);
            return;
        }

        // Idle animation
        if (client.gun_frame < FRAME_IDLE_LAST) {
            client.gun_frame++;
            client.weapon_think_time = time + Weapon_AnimationTime(ent);

            // Pause frames
            if (pause_frames) {
                for (const frame of pause_frames) {
                    if (client.gun_frame === frame) {
                        // rand() & 15 returns non-zero 15/16 times.
                        // So 15/16 chance to pause (return).
                        if (firingRandom.frandom() < 0.9375) {
                            return;
                        }
                    }
                }
            }
            return;
        }

        // Loop idle
        client.gun_frame = FRAME_FIRE_LAST + 1;
        client.weapon_think_time = time + Weapon_AnimationTime(ent);
        return;
    }

    if (client.weaponstate === WeaponStateEnum.WEAPON_FIRING) {
        // Fire frames logic
        if (fire_frames) {
             for (const frame of fire_frames) {
                 if (client.gun_frame === frame) {
                     if (fire) fire(ent);
                     break;
                 }
             }
        }

        if (client.gun_frame < FRAME_FIRE_LAST) {
            client.gun_frame++;
            client.weapon_think_time = time + Weapon_AnimationTime(ent);
            return;
        }

        // Check for pending switch
        if (client.newWeapon) {
            ChangeWeapon(ent, client.newWeapon);
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
    FRAME_ACTIVATE_LAST: number,
    FRAME_FIRE_LAST: number,
    FRAME_IDLE_LAST: number,
    FRAME_DEACTIVATE_LAST: number,
    pause_frames: number[] | null,
    fire: (ent: Entity) => void,
    sys: EntitySystem
) {
    if (!ent.client) return;
    const client = ent.client;

    const FRAME_FIRE_FIRST = FRAME_ACTIVATE_LAST + 1;

    if (client.weaponstate === WeaponStateEnum.WEAPON_FIRING) {
        // Logic:
        // if ( (ent->client->ps.gunframe == fire_last) || (ent->client->ps.gunframe == idle_last) )
        //    ent->client->ps.gunframe = fire_frame;
        // else
        //    ent->client->ps.gunframe++;

        // Note: C code checks idle_last too, why? Maybe for looping from idle back to fire?
        // But here we are in FIRING state.

        if (client.gun_frame === FRAME_FIRE_LAST || client.gun_frame === FRAME_IDLE_LAST) {
            client.gun_frame = FRAME_FIRE_FIRST;
        } else {
            client.gun_frame++;
        }

        if (fire) {
            fire(ent);
        }

        // Check if button released
        if (!((client.buttons) & 1 /* BUTTON_ATTACK */)) {
            client.gun_frame = FRAME_IDLE_LAST + 1;
            client.weaponstate = WeaponStateEnum.WEAPON_READY;

            // Check for pending switch immediately upon release
            if (client.newWeapon) {
                 ChangeWeapon(ent, client.newWeapon);
                return;
            }
        }

        client.weapon_think_time = sys.timeSeconds + Weapon_AnimationTime(ent);

    } else {
        // Delegate to generic for activation/ready/dropping
        Weapon_Generic(
            ent,
            FRAME_ACTIVATE_LAST,
            FRAME_FIRE_LAST,
            FRAME_IDLE_LAST,
            FRAME_DEACTIVATE_LAST,
            pause_frames,
            null,
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

    // Handle DROPPING state for grenades.
    // Since grenades don't have explicit deactivate frames passed in this signature,
    // we use a safe fallback to finalize the switch immediately or animate if frames are known.
    // For robust porting, we should finish the switch to avoid getting stuck.
    if (client.weaponstate === WeaponStateEnum.WEAPON_DROPPING) {
         ChangeWeapon(ent);
        return;
    }

    // WEAPON_READY: Can start throw
    if (client.weaponstate === WeaponStateEnum.WEAPON_READY) {
        if ((client.buttons & 1)) { // Attack button
            client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
            client.gun_frame = FRAME_THROW_FIRST;
            // Start cook logic in FIRING state
            return;
        }

        // Check pending switch
        if (client.newWeapon) {
            ChangeWeapon(ent, client.newWeapon);
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

        // Check switch after throw
        if (client.newWeapon) {
             ChangeWeapon(ent, client.newWeapon);
            return;
        }
    }
}
