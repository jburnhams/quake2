import { Entity, MoveType, Solid, DeadFlag } from './entity.js';
import { createPlayerInventory, WeaponId, clearExpiredPowerups, PowerupId } from '../inventory/playerInventory.js';
import { createPlayerWeaponStates } from '../combat/weapons/state.js';
import { WEAPON_ITEMS } from '../inventory/items.js';
import { throwGibs } from './gibs.js';
import { DamageMod, damageModName } from '../combat/damageMods.js';
import { EntitySystem } from './system.js';
import { ClientObituary } from '../combat/obituary.js';
import {
    FRAME_death101, FRAME_death106,
    FRAME_death201, FRAME_death206,
    FRAME_death301, FRAME_death306,
    FRAME_crdeath1, FRAME_crdeath5,
    FRAME_pain101, FRAME_pain104,
    FRAME_pain201, FRAME_pain204,
    FRAME_pain301, FRAME_pain304,
    FRAME_crpain1, FRAME_crpain4,
    FRAME_run1, FRAME_run6,
    FRAME_stand01, FRAME_stand40,
    ANIM_BASIC, ANIM_DEATH, ANIM_PAIN, ANIM_REVERSE, ANIM_ATTACK
} from './player_anim.js';
import { firingRandom } from '../combat/weapons/firing.js';

export function P_PlayerThink(ent: Entity, sys: EntitySystem) {
    if (!ent.client) return;

    // Decay damage alpha
    if (ent.client.damage_alpha) {
        ent.client.damage_alpha -= 0.1 * 2.0;
        if (ent.client.damage_alpha < 0) {
            ent.client.damage_alpha = 0;
        }
    }

    // Animation update
    const client = ent.client;
    let animChanged = false;

    // If dead, animation logic is different
    if (ent.deadflag) {
        // Handled in death think mostly, but let's check
        // If animation not finished, continue
    } else {
        // Movement animation
        // Check velocity
        const speed = Math.sqrt(ent.velocity.x * ent.velocity.x + ent.velocity.y * ent.velocity.y);
        const moving = speed > 10; // Minimal speed

        // Only update movement animation if we are in BASIC animation priority
        if (client.anim_priority === ANIM_BASIC || client.anim_priority === undefined) {
            if (moving) {
                // Run
                // If not already running, start
                if (ent.frame < FRAME_run1 || ent.frame > FRAME_run6) {
                    ent.frame = FRAME_run1;
                    client.anim_end = FRAME_run6;
                    client.anim_priority = ANIM_BASIC;
                    animChanged = true;
                }
            } else {
                // Stand
                // If running, switch to stand
                // Or if we are in basic priority but our anim_end doesn't match stand end (e.g. initialized to 0), fix it.
                if ((ent.frame >= FRAME_run1 && ent.frame <= FRAME_run6) ||
                    (client.anim_priority === ANIM_BASIC && client.anim_end !== FRAME_stand40) ||
                    client.anim_priority === undefined) {
                    ent.frame = FRAME_stand01;
                    client.anim_end = FRAME_stand40;
                    client.anim_priority = ANIM_BASIC;
                    animChanged = true;
                }
            }
        }
    }

    if (animChanged) {
        return;
    }

    // Advance frame
    if (client.anim_end !== undefined && client.anim_end !== ent.frame) {
        if (ent.frame < client.anim_end) {
            ent.frame++;
        } else if (ent.frame > client.anim_end) {
            // Handle Reverse
            ent.frame--; // Decrement towards target
        }
    } else if (client.anim_end === ent.frame) {
         if (client.anim_priority === ANIM_BASIC) {
                // Reset loop
                if (ent.frame === FRAME_run6) ent.frame = FRAME_run1;
                else if (ent.frame === FRAME_stand40) ent.frame = FRAME_stand01;
         } else {
             // Non-looping animation finished
             if (client.anim_priority !== ANIM_DEATH) {
                 client.anim_priority = ANIM_BASIC;
             }
         }
    }
}

export function player_pain(self: Entity, damage: number) {
    if (!self.client) return;

    // Pick pain animation
    if (self.health < 40) {
        // Heavy pain
        // Randomly pick
    }

    // For now, basic implementation
    if (self.client.anim_priority && self.client.anim_priority >= ANIM_PAIN) {
        return; // Already in pain or death
    }

    self.client.anim_priority = ANIM_PAIN;
    self.client.damage_alpha = 1.0;
    self.client.damage_blend = [1, 0, 0];

    const r = firingRandom.frandom();
    if (r < 0.33) {
        self.frame = FRAME_pain101;
        self.client.anim_end = FRAME_pain104;
    } else if (r < 0.66) {
        self.frame = FRAME_pain201;
        self.client.anim_end = FRAME_pain204;
    } else {
        self.frame = FRAME_pain301;
        self.client.anim_end = FRAME_pain304;
    }
}

export function player_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: any, mod: DamageMod, sys?: EntitySystem) {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;
    self.movetype = MoveType.Toss;
    self.takedamage = false; // Can be gibbed? If dead, further damage usually gibs.

    // Check for gibbing
    if (self.health < -40 && sys) {
        throwGibs(sys, self.origin, damage);
        return; // No death anim if gibbed
    }

    // Death animation
    if (self.client) {
        self.client.anim_priority = ANIM_DEATH;
        const r = firingRandom.frandom();
        if (r < 0.33) {
            self.frame = FRAME_death101;
            self.client.anim_end = FRAME_death106;
        } else if (r < 0.66) {
            self.frame = FRAME_death201;
            self.client.anim_end = FRAME_death206;
        } else {
            self.frame = FRAME_death301;
            self.client.anim_end = FRAME_death306;
        }
    } else {
        self.frame = 0;
    }

    // Obituaries
    if (sys) {
        ClientObituary(self, inflictor, attacker, mod, sys);
    }

    // Weapon drop (optional)

    // Respawn logic?
    // In SP, player death usually restarts level.
    // We need `game` context to restart level?
}

export function player_think(self: Entity, sys: EntitySystem) {
    if (!self.client) return;

    // Check powerups
    const nowMs = sys.timeSeconds * 1000;

    // Quad/Double Damage Sound
    // Ref: rerelease/p_weapon.cpp:656 Weapon_PowerupSound
    const quadTime = self.client.quad_time || 0;
    const doubleTime = self.client.double_time || 0;
    const soundTime = self.client.quadsound_time || 0;

    if ((quadTime > sys.timeSeconds) || (doubleTime > sys.timeSeconds)) {
        if (soundTime < sys.timeSeconds) {
            self.client.quadsound_time = sys.timeSeconds + 1.0;
            sys.sound(self, 2, 'items/damage3.wav', 1, 1, 0); // CHAN_ITEM = 2
        }
    }

    // Warn about expiration
    for (const [id, expiresAt] of self.client.inventory.powerups.entries()) {
        if (expiresAt === null) continue;

        const remaining = (expiresAt - nowMs) / 1000;

        // Warning sound at 4 seconds remaining
        // Standard behavior: play a sound when countdown is low.
        // We check if the fractional part is small enough to trigger once per second.
        // Since think interval is 0.1s, we use < 0.1 window.
        if (remaining <= 4 && remaining > 0) {
            if ((remaining % 1.0) < 0.1) {
                 // Use a generic powerup sound or specific one if available.
                 // 'misc/power1.wav' is often used for powerup wearoff/warning.
                 sys.sound(self, 0, 'misc/power1.wav', 1, 1, 0);
            }
        }
    }

    clearExpiredPowerups(self.client.inventory, nowMs);

    // Weapon think
    const weaponId = self.client.inventory.currentWeapon;
    if (weaponId) {
        const weaponItem = Object.values(WEAPON_ITEMS).find(item => item.weaponId === weaponId);
        if (weaponItem) {
            // Update ammo count cache
            if (weaponItem.ammoType !== null) {
                self.client.currentAmmoCount = self.client.inventory.ammo.counts[weaponItem.ammoType];
            } else {
                self.client.currentAmmoCount = 0;
            }

            if (weaponItem.think) {
                weaponItem.think(self, sys);
            }
        }
    }

    // Player Animation
    P_PlayerThink(self, sys);

    self.nextthink = sys.timeSeconds + 0.1;
    sys.scheduleThink(self, self.nextthink);
}
