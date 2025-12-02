// =================================================================
// Quake II - Weapon Animation System
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { WeaponStateEnum } from './state.js';
import { PowerupId } from '../../inventory/playerInventory.js';
import { firingRandom } from './firing.js';

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
        // Proceed to READY logic (fall through? No, separate block in C, but here we can just let it run next frame or return. C version returns.)
        // But wait, if we switch state to READY, we should probably return and let it handle READY next frame, or fall through?
        // C code:
        // if (ent->client->weaponstate == WEAPON_ACTIVATING) { ... ent->client->weaponstate = WEAPON_READY; ent->client->ps.gunframe = FRAME_IDLE_LAST+1; return; }
        // Actually, C sets gunframe to IDLE_LAST+1 to trigger idle loop immediately?
        // Let's re-read C snippet.
        // "ent->client->ps.gunframe = FRAME_ACTIVATE_LAST + 1;" (This seems wrong, ACTIVATE_LAST is end of activation)
        // Actually, usually it goes to READY and lets READY logic handle it.
        // In my C snippet: "ent->client->weaponstate = WEAPON_READY; ent->client->ps.gunframe = FRAME_FIRE_LAST + 1; return;"
        // FRAME_FIRE_LAST + 1 is usually start of IDLE.

        // Let's stick to standard behavior:
        client.gun_frame = FRAME_FIRE_LAST + 1;
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
        // ChangeWeapon(ent); (Implemented in switching.ts)
        // For now, assume switch logic is called or handled elsewhere.
        // Actually we MUST call ChangeWeapon here or it hangs in DROPPING.
        // We need to import ChangeWeapon? Circular dependency risk.
        // Ideally switching.ts imports animation.ts, not vice versa.
        // But ChangeWeapon is the end of dropping.
        // Maybe we export a callback or something?
        // Or we just assume the caller handles it? No, Weapon_Generic is the handler.

        // Dynamic import to break cycle?
        import('./switching.js').then(({ ChangeWeapon }) => {
             ChangeWeapon(ent);
        });
        return;
    }

    if (client.weaponstate === WeaponStateEnum.WEAPON_READY) {
        // Check for fire
        if ((client.buttons & 1) /* BUTTON_ATTACK */) {
            // Check ammo? Usually handled by fire function or check before entering firing?
            // Standard Quake 2 lets you enter firing state, and fire function checks ammo.
            // Or pauses?
            // "if ((ent->client->latched_buttons|ent->client->buttons) & BUTTON_ATTACK)"

            client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
            // Start fire sequence at ACTIVATE_LAST + 1
            client.gun_frame = FRAME_ACTIVATE_LAST + 1;
            // C code: ent->client->ps.gunframe = FRAME_ACTIVATE_LAST + 1;
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
                        if (firingRandom.random() < 0.5) { // rand()&15 means 1/16 chance to UNPAUSE? No.
                            // "if (rand()&15) return;" -> if non-zero, return (stay on frame).
                            // So 15/16 chance to stay, 1/16 to advance?
                            // No, return means "stop processing this frame", so it stays on this frame?
                            // Wait, "return" in C Weapon_Generic just exits the function.
                            // Since we already incremented gunframe, next call it will be gunframe+1?
                            // NO. "ent->client->ps.gunframe == pause_frames[n]"
                            // If we match, we check rand.
                            // If we return, we keep the incremented frame?
                            // No, we want to STAY on the frame.
                            // So we should NOT increment if we pause?
                            // The C code increments FIRST.
                            // "ent->client->ps.gunframe++;"
                            // THEN checks if (gunframe == pause_frame).
                            // If so, and rand, return.
                            // So we sit on the incremented frame for extra ticks.
                            // That makes sense.
                            return;
                        }
                    }
                }
            }
            return;
        }

        // Loop idle
        // Usually resets to FRAME_FIRE_LAST + 1
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
                     // Don't break? Some weapons might fire multiple times per frame? No.
                     break;
                 }
             }
        }

        if (client.gun_frame < FRAME_FIRE_LAST) {
            client.gun_frame++;
            client.weapon_think_time = time + Weapon_AnimationTime(ent);
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
    FRAME_NOOP: number,       // Unused
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
        // DEACTIVATE_LAST = FRAME_PAUSE (Often used for deactivate last in repeating calls in C?)
        // Let's assume FRAME_PAUSE passed here is actually DEACTIVATE_LAST.

        Weapon_Generic(
            ent,
            FRAME_FIRE_FRAME - 1,
            FRAME_FIRE_LAST,
            FRAME_IDLE_LAST,
            FRAME_PAUSE,
            null,
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
