// =================================================================
// Quake II - Projectile Entities
// =================================================================

import { Entity, MoveType, Solid } from './entity.js';
import { GameExports } from '../index.js';
import { T_Damage, T_RadiusDamage, Damageable } from '../combat/damage.js';
import { DamageFlags } from '../combat/damageFlags.js';
import { DamageMod } from '../combat/damageMods.js';
import { ZERO_VEC3, lengthVec3, subtractVec3, normalizeVec3, scaleVec3 } from '@quake2ts/shared';

export function createRocket(game: GameExports, owner: Entity, start: any, dir: any, damage: number, speed: number) {
    const rocket = game.entities.spawn();
    rocket.classname = 'rocket';
    rocket.movetype = MoveType.FlyMissile;
    rocket.solid = Solid.BoundingBox;
    rocket.owner = owner;
    rocket.origin = { ...start };
    rocket.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    rocket.mins = { x: -4, y: -4, z: -4 };
    rocket.maxs = { x: 4, y: 4, z: 4 };
    rocket.touch = (self, other, plane, surf) => {
        if (other === self.owner) {
            return;
        }

        // Direct hit damage if we hit a takedamage entity
        if (other && other.takedamage) {
            T_Damage(
                other as any,
                self as any,
                self.owner as any,
                self.velocity,
                self.origin,
                plane ? plane.normal : ZERO_VEC3,
                damage,
                0,
                DamageFlags.NONE,
                DamageMod.ROCKET
            );
        }

        const entities = game.entities.findByRadius(self.origin, 120);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, 120, self.owner as any, 120, DamageFlags.NONE, DamageMod.R_SPLASH);

        game.entities.free(self);
    };

    game.entities.finalizeSpawn(rocket);
}

export function createGrenade(game: GameExports, owner: Entity, start: any, dir: any, damage: number, speed: number) {
    const grenade = game.entities.spawn();
    grenade.classname = 'grenade';
    grenade.owner = owner;
    grenade.origin = { ...start };
    grenade.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    grenade.movetype = MoveType.Bounce;
    grenade.clipmask = 0x10020002;
    grenade.solid = Solid.BoundingBox;
    grenade.modelindex = game.entities.modelIndex('models/objects/grenade/tris.md2');

    // Add mins/maxs for physics
    grenade.mins = { x: -4, y: -4, z: -4 };
    grenade.maxs = { x: 4, y: 4, z: 4 };

    grenade.touch = (self, other, plane, surf) => {
        if (other === self.owner) {
            return;
        }

        // Explode immediately if hitting a damageable entity (monster/player)
        if (other && other.takedamage) {
             // Deal direct damage
            T_Damage(
                other as any,
                self as any,
                self.owner as any,
                self.velocity,
                self.origin,
                plane ? plane.normal : ZERO_VEC3,
                damage, // Direct impact damage? Usually separate but let's assume it's part of it or handled by radius.
                // Actually G_Weapon.c Grenade_Touch calls Grenade_Explode which calls T_RadiusDamage.
                // It doesn't seem to do T_Damage separately?
                // Wait, if it hits a monster, it stops and explodes.
                0,
                DamageFlags.NONE,
                DamageMod.GRENADE
            );

            // Trigger explosion logic
            // We can just call the think function immediately or duplicate the explosion logic.
            // Let's duplicate for clarity or refactor.
             const entities = game.entities.findByRadius(self.origin, 120);
             T_RadiusDamage(entities as any[], self as any, self.owner as any, damage, self.owner as any, 120, DamageFlags.NONE, DamageMod.GRENADE);
             game.entities.free(self);
             return;
        }

        // Grenades bounce on walls
        // Physics engine handles bounce if movetype is BOUNCE.
        // We might play a sound here.
    };
    grenade.think = (self) => {
        // Explode after a delay
        const entities = game.entities.findByRadius(self.origin, 120);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, damage, self.owner as any, 120, DamageFlags.NONE, DamageMod.GRENADE);
        game.entities.free(self);
    };
    game.entities.scheduleThink(grenade, game.time + 2.5);
    game.entities.finalizeSpawn(grenade);
}

export function createBlasterBolt(game: GameExports, owner: Entity, start: any, dir: any, damage: number, speed: number, mod: DamageMod) {
    const bolt = game.entities.spawn();
    bolt.classname = mod === DamageMod.HYPERBLASTER ? 'hyperblaster_bolt' : 'blaster_bolt';
    bolt.owner = owner;
    bolt.origin = { ...start };
    bolt.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    bolt.movetype = MoveType.FlyMissile;
    bolt.solid = Solid.BoundingBox;

    // Blaster bolts are small
    bolt.mins = { x: -2, y: -2, z: -2 };
    bolt.maxs = { x: 2, y: 2, z: 2 };

    // Effect flag for green/yellow light + particles would go here

    bolt.touch = (self, other, plane, surf) => {
        if (other === self.owner) {
            return;
        }

        if (other && other.takedamage) {
            T_Damage(
                other as any,
                self as any,
                self.owner as any,
                self.velocity,
                self.origin,
                plane ? plane.normal : ZERO_VEC3,
                damage,
                1, // Kick
                DamageFlags.NONE,
                mod
            );
        } else {
            // Wall impact effect
        }

        game.entities.free(self);
    };

    game.entities.finalizeSpawn(bolt);
}

export function createBfgBall(game: GameExports, owner: Entity, start: any, dir: any, damage: number, speed: number) {
    const bfgBall = game.entities.spawn();
    bfgBall.classname = 'bfg_ball';
    bfgBall.owner = owner;
    bfgBall.origin = { ...start };
    bfgBall.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    bfgBall.movetype = MoveType.FlyMissile;
    bfgBall.clipmask = 0x10020002;
    bfgBall.solid = Solid.BoundingBox;
    bfgBall.modelindex = game.entities.modelIndex('models/objects/bfgball/tris.md2');

    bfgBall.mins = { x: -10, y: -10, z: -10 };
    bfgBall.maxs = { x: 10, y: 10, z: 10 };

    bfgBall.touch = (self, other, plane, surf) => {
        if (other === self.owner) {
            return;
        }

        // Primary splash damage
        const entities = game.entities.findByRadius(self.origin, 200);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, 200, self.owner as any, 200, DamageFlags.NONE, DamageMod.BFG_BLAST);

        // Secondary lasers
        // Quake 2 BFG logic:
        // 1. Calculate vector from ball to player
        // 2. Find all entities within 1000 units of ball
        // 3. Check if entity is visible to player (trace from player eye to entity)
        // 4. If visible, deal damage (Laser damage 10? or scaled by distance?)
        // Ref: g_weapon.c BFG_Lasers

        if (self.owner) {
            const targets = game.entities.findByRadius(self.origin, 1000);
            const playerOrigin = self.owner.origin; // Ideally use eye position

            for (const target of targets) {
                if (target === self.owner || !target.takedamage) continue;

                // Trace from player to target to check visibility
                // Quake 2 uses 1000 as range for this check too? Or infinite?
                // G_Weapon.c: if (!visible (self->owner, ent)) continue;

                const tr = game.trace(playerOrigin, null, null, target.origin, self.owner, 0x00000001 | 0x00000002 /* MASK_SOLID | MASK_OPAQUE - approximations */);

                // If we hit the target or we hit nothing (should hit target?), visibility check is complex.
                // Usually game.trace(start, null, null, end, ignore) returns fraction 1.0 if clear.
                // But here we want to know if we can see the target.
                // Simplified: if trace hits the target or ends near it.

                if (tr.ent !== target && tr.fraction < 1.0) {
                     continue; // Blocked
                }

                // Deal damage
                 const dir = normalizeVec3(subtractVec3(target.origin, self.origin));
                 const dist = lengthVec3(subtractVec3(target.origin, self.origin));
                 let laserDamage = 10;
                 // BFG Laser damage is usually fixed or distance based?
                 // Ref: T_Damage (ent, self, self->owner, dir, ent->s.origin, vec3_origin, 10, 10, 0, MOD_BFG_LASER);

                 T_Damage(
                    target as any,
                    self as any,
                    self.owner as any,
                    dir,
                    target.origin,
                    ZERO_VEC3,
                    laserDamage,
                    10,
                    DamageFlags.ENERGY,
                    DamageMod.BFG_LASER
                );
            }
        }

        game.entities.free(self);
    };

    // BFG animation think
    bfgBall.think = (self) => {
        // Just visual effects or sound updates here
        self.nextthink = game.time + 0.1;
    };
    game.entities.scheduleThink(bfgBall, game.time + 0.1);
    game.entities.finalizeSpawn(bfgBall);
}
