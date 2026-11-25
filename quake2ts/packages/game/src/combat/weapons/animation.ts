// =================================================================
// Quake II - Weapon Animation System
// =================================================================

import { PlayerButton } from '@quake2ts/shared';
import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { WeaponStateEnum } from './state.js';
import { PowerupId } from '../../inventory/playerInventory.js';
import { firingRandom } from './firing.js';
import { ChangeWeapon, NoAmmoWeaponChange } from './switching.js';
import { WEAPON_ITEMS } from '../../inventory/items.js';
import { WeaponId } from '../../inventory/playerInventory.js';
import { Weapon_AnimationTime } from './common.js';

const BUTTON_ATTACK = PlayerButton.Attack;
const BUTTON_HOLSTER = PlayerButton.Holster;
/** The port's alt-fire (blaster melee, guided rocket...), not in the rerelease: it fires like attack. */
const FIRE_BUTTONS = PlayerButton.Attack | PlayerButton.Attack2;

/** Ammo each shot takes, by weapon (the item's quantity in the rerelease's itemlist). */
const AMMO_PER_SHOT: Partial<Record<WeaponId, number>> = {
    [WeaponId.SuperShotgun]: 2,
    [WeaponId.BFG10K]: 50,
};

/** Times are seconds on a 25 ms clock; compare them in whole milliseconds, as gtime_t does. */
const ms = (t: number | null | undefined) => Math.round((t ?? 0) * 1000);
const reached = (t: number | null | undefined, now: number) => ms(t) <= ms(now);

/** Whether the current weapon has the ammo for a shot (Weapon_HandleReady's check). */
function hasAmmoForShot(client: NonNullable<Entity['client']>): boolean {
    const weaponId = client.inventory.currentWeapon;
    if (!weaponId) return true;
    const item = Object.values(WEAPON_ITEMS).find((w) => w.weaponId === weaponId);
    if (!item || item.ammoType === null || item.ammoType === undefined) return true;
    return (client.inventory.ammo.counts[item.ammoType] ?? 0) >= (AMMO_PER_SHOT[weaponId] ?? 1);
}

/** Weapon_CanAnimate: a corpse's weapon does not animate. */
const canAnimate = (ent: Entity) => !ent.deadflag;

/** Weapon_SetFinished: the time until the weapon may fire again. */
function setFinished(ent: Entity, now: number) {
    ent.client!.weapon_fire_finished = now + Weapon_AnimationTime(ent);
}

/** Weapon_HandleDropping */
function handleDropping(ent: Entity, FRAME_DEACTIVATE_LAST: number, now: number): boolean {
    const client = ent.client!;
    if (client.weaponstate !== WeaponStateEnum.WEAPON_DROPPING) return false;
    if (reached(client.weapon_think_time, now)) {
        if (client.gun_frame === FRAME_DEACTIVATE_LAST) {
            ChangeWeapon(ent);
            return true;
        }
        client.gun_frame++;
        client.weapon_think_time = now + Weapon_AnimationTime(ent);
    }
    return true;
}

/** Weapon_HandleActivating */
function handleActivating(ent: Entity, FRAME_ACTIVATE_LAST: number, FRAME_IDLE_FIRST: number, now: number): boolean {
    const client = ent.client!;
    if (client.weaponstate !== WeaponStateEnum.WEAPON_ACTIVATING) return false;
    if (!reached(client.weapon_think_time, now)) return false;
    client.weapon_think_time = now + Weapon_AnimationTime(ent);
    if (client.gun_frame === FRAME_ACTIVATE_LAST) {
        client.weaponstate = WeaponStateEnum.WEAPON_READY;
        client.gun_frame = FRAME_IDLE_FIRST;
        client.weapon_fire_buffered = false;
        setFinished(ent, now);
        return true;
    }
    client.gun_frame++;
    return true;
}

/** Weapon_HandleNewWeapon */
function handleNewWeapon(ent: Entity, FRAME_DEACTIVATE_FIRST: number, now: number): boolean {
    const client = ent.client!;
    const holstering = !!(((client.latched_buttons ?? 0) | client.buttons) & BUTTON_HOLSTER);
    if (!(client.newWeapon || holstering) || client.weaponstate === WeaponStateEnum.WEAPON_FIRING) return false;
    if (reached(client.weapon_think_time, now)) {
        if (!client.newWeapon) client.newWeapon = client.inventory.currentWeapon ?? undefined;
        client.weaponstate = WeaponStateEnum.WEAPON_DROPPING;
        client.gun_frame = FRAME_DEACTIVATE_FIRST;
        client.weapon_think_time = now + Weapon_AnimationTime(ent);
    }
    return true;
}

const READY_NONE = 0;
const READY_CHANGING = 1;
const READY_FIRING = 2;

/** Weapon_HandleReady */
function handleReady(ent: Entity, sys: EntitySystem, FRAME_IDLE_FIRST: number, FRAME_IDLE_LAST: number, pause_frames: number[] | null, now: number): number {
    const client = ent.client!;
    if (client.weaponstate !== WeaponStateEnum.WEAPON_READY) return READY_NONE;
    const requestFiring = client.weapon_fire_buffered || !!(((client.latched_buttons ?? 0) | client.buttons) & FIRE_BUTTONS);

    if (requestFiring && reached(client.weapon_fire_finished, now)) {
        client.latched_buttons = (client.latched_buttons ?? 0) & ~FIRE_BUTTONS;
        client.weapon_think_time = now;
        if (hasAmmoForShot(client)) {
            client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
            return READY_FIRING;
        }
        NoAmmoWeaponChange(ent, sys);
        return READY_CHANGING;
    }
    if (reached(client.weapon_think_time, now)) {
        client.weapon_think_time = now + Weapon_AnimationTime(ent);
        if (client.gun_frame === FRAME_IDLE_LAST) {
            client.gun_frame = FRAME_IDLE_FIRST;
            return READY_CHANGING;
        }
        if (pause_frames) {
            for (const frame of pause_frames) {
                // irandom(16): non-zero fifteen times in sixteen.
                if (client.gun_frame === frame && firingRandom.irandom(16)) return READY_CHANGING;
            }
        }
        client.gun_frame++;
        return READY_CHANGING;
    }
    return READY_NONE;
}

/** Weapon_HandleFiring */
function handleFiring(ent: Entity, FRAME_IDLE_FIRST: number, fire: () => void, now: number) {
    const client = ent.client!;
    setFinished(ent, now);
    if (client.weapon_fire_buffered) {
        client.buttons |= BUTTON_ATTACK;
        client.weapon_fire_buffered = false;
    }
    fire();
    if (client.gun_frame === FRAME_IDLE_FIRST) {
        client.weaponstate = WeaponStateEnum.WEAPON_READY;
        client.weapon_fire_buffered = false;
    }
    client.weapon_think_time = now + Weapon_AnimationTime(ent);
}

/**
 * Weapon_Generic (rerelease p_weapon.cpp): the state machine every view weapon runs through,
 * dropping, raising, switching, idling and firing on its fire frames. Called each server frame
 * (Think_Weapon), and stepped by weapon_think_time at the weapon's 10 Hz.
 * Leaves out the player model's attack and pain animations and the powerup sound.
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
    const now = sys.timeSeconds;
    const FRAME_FIRE_FIRST = FRAME_ACTIVATE_LAST + 1;
    const FRAME_IDLE_FIRST = FRAME_FIRE_LAST + 1;
    const FRAME_DEACTIVATE_FIRST = FRAME_IDLE_LAST + 1;
    const fireOnFireFrame = () => {
        if (fire_frames?.includes(client.gun_frame)) fire(ent);
    };

    if (!canAnimate(ent)) return;
    if (handleDropping(ent, FRAME_DEACTIVATE_LAST, now)) return;
    if (handleActivating(ent, FRAME_ACTIVATE_LAST, FRAME_IDLE_FIRST, now)) return;
    if (handleNewWeapon(ent, FRAME_DEACTIVATE_FIRST, now)) return;
    const state = handleReady(ent, sys, FRAME_IDLE_FIRST, FRAME_IDLE_LAST, pause_frames, now);
    if (state !== READY_NONE) {
        if (state === READY_FIRING) {
            client.gun_frame = FRAME_FIRE_FIRST;
            client.weapon_fire_buffered = false;
            if (client.weapon_thunk) client.weapon_think_time = (client.weapon_think_time ?? now) + sys.frameTimeSeconds;
            client.weapon_think_time = (client.weapon_think_time ?? now) + Weapon_AnimationTime(ent);
            setFinished(ent, now);
            fireOnFireFrame();
        }
        return;
    }

    if (client.weaponstate === WeaponStateEnum.WEAPON_FIRING && reached(client.weapon_think_time, now)) {
        client.gun_frame++;
        handleFiring(ent, FRAME_IDLE_FIRST, fireOnFireFrame, now);
    }
}

/**
 * Weapon_Repeating (rerelease p_weapon.cpp), for weapons that fire every frame while the
 * button is held. In the rerelease the fire function steps the gun frame and decides when to
 * stop; the port's fire functions only fire, so the firing step here loops the fire frames while
 * attack is held and goes back to idle when it is let go.
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
    const now = sys.timeSeconds;
    const FRAME_FIRE_FIRST = FRAME_ACTIVATE_LAST + 1;
    const FRAME_IDLE_FIRST = FRAME_FIRE_LAST + 1;
    const FRAME_DEACTIVATE_FIRST = FRAME_IDLE_LAST + 1;

    if (!canAnimate(ent)) return;
    if (handleDropping(ent, FRAME_DEACTIVATE_LAST, now)) return;
    if (handleActivating(ent, FRAME_ACTIVATE_LAST, FRAME_IDLE_FIRST, now)) return;
    if (handleNewWeapon(ent, FRAME_DEACTIVATE_FIRST, now)) return;
    if (handleReady(ent, sys, FRAME_IDLE_FIRST, FRAME_IDLE_LAST, pause_frames, now) === READY_CHANGING) return;

    if (client.weaponstate === WeaponStateEnum.WEAPON_FIRING && reached(client.weapon_think_time, now)) {
        handleFiring(ent, FRAME_IDLE_FIRST, () => {
            if (!(client.buttons & FIRE_BUTTONS)) {
                client.gun_frame = FRAME_IDLE_FIRST;
                return;
            }
            // Out of ammo with attack held: wind down and change weapon, as the rerelease's
            // repeating fire functions do (Weapon_HyperBlaster_Fire, Chaingun_Fire).
            if (!hasAmmoForShot(client)) {
                NoAmmoWeaponChange(ent, sys);
                client.gun_frame = FRAME_IDLE_FIRST;
                return;
            }
            client.gun_frame = client.gun_frame >= FRAME_FIRE_FIRST && client.gun_frame < FRAME_FIRE_LAST ? client.gun_frame + 1 : FRAME_FIRE_FIRST;
            fire(ent);
        }, now);
        if (client.weapon_thunk) client.weapon_think_time = (client.weapon_think_time ?? now) + sys.frameTimeSeconds;
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

    // WEAPON_ACTIVATING: thrown weapons have no raise animation; they are ready on the next
    // weapon frame (rerelease Throw_Generic).
    if (client.weaponstate === WeaponStateEnum.WEAPON_ACTIVATING) {
        client.weaponstate = WeaponStateEnum.WEAPON_READY;
        client.gun_frame = FRAME_FIRE_LAST + 1;
        client.weapon_fire_finished = time + Weapon_AnimationTime(ent);
        return;
    }

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
