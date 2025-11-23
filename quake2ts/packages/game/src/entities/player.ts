import { Entity, MoveType, Solid, DeadFlag } from './entity.js';
import { createPlayerInventory, WeaponId } from '../inventory/playerInventory.js';
import { createPlayerWeaponStates } from '../combat/weapons/state.js';
import { throwGibs } from './gibs.js';
import { DamageMod, damageModName } from '../combat/damageMods.js';
import { EntitySystem } from './system.js';

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
        // Generate death message
        let message = "You died.";
        if (attacker) {
            if (attacker === self) {
                message = "You killed yourself.";
            } else {
                // Use mod name or attacker classname
                message = `You were killed by ${attacker.classname} (${damageModName(mod)})`;
            }
        } else {
             message = `You died (${damageModName(mod)})`;
        }
        sys.engine.centerprintf?.(self, message);
    }

    // Weapon drop (optional)

    // Respawn logic?
    // In SP, player death usually restarts level.
    // We need `game` context to restart level?
}
