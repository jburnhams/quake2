import { Entity, MoveType, Solid, DeadFlag } from './entity.js';
import { createPlayerInventory, WeaponId, clearExpiredPowerups, PowerupId } from '../inventory/playerInventory.js';
import { createPlayerWeaponStates } from '../combat/weapons/state.js';
import { throwGibs } from './gibs.js';
import { DamageMod, damageModName } from '../combat/damageMods.js';
import { EntitySystem } from './system.js';
import { ClientObituary } from '../combat/obituary.js';

export function player_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: any, mod: DamageMod, sys?: EntitySystem) {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;
    self.movetype = MoveType.Toss;
    self.takedamage = false; // Can be gibbed? If dead, further damage usually gibs.

    // Check for gibbing
    if (self.health < -40 && sys) {
        throwGibs(sys, self.origin, damage);
    }

    // Death animation
    self.frame = 0; // Start death frame
    // We don't have animation frames defined for player yet.

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

    self.nextthink = sys.timeSeconds + 0.1;
    sys.scheduleThink(self, self.nextthink);
}
