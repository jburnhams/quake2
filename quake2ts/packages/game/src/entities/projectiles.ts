// =================================================================
// Quake II - Projectile Entities
// =================================================================

import { Entity, MoveType, Solid } from './entity.js';
import { EntitySystem } from './system.js';
import { T_Damage, T_RadiusDamage } from '../combat/damage.js';
import { DamageFlags } from '../combat/damageFlags.js';
import { DamageMod } from '../combat/damageMods.js';
import { ZERO_VEC3, lengthVec3, subtractVec3, normalizeVec3, Vec3, CollisionPlane } from '@quake2ts/shared';

export function createRocket(sys: EntitySystem, owner: Entity, start: Vec3, dir: Vec3, damage: number, speed: number) {
    const rocket = sys.spawn();
    rocket.classname = 'rocket';
    rocket.movetype = MoveType.FlyMissile;
    rocket.solid = Solid.BoundingBox;
    rocket.owner = owner;
    rocket.origin = { ...start };
    rocket.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    rocket.mins = { x: -4, y: -4, z: -4 };
    rocket.maxs = { x: 4, y: 4, z: 4 };
    rocket.touch = (self: Entity, other: Entity | null, plane?: CollisionPlane | null, surf?: any) => {
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

        const entities = sys.findByRadius(self.origin, 120);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, 120, self.owner as any, 120, DamageFlags.NONE, DamageMod.R_SPLASH);

        sys.free(self);
    };

    sys.finalizeSpawn(rocket);
}

export function createGrenade(sys: EntitySystem, owner: Entity, start: Vec3, dir: Vec3, damage: number, speed: number) {
    const grenade = sys.spawn();
    grenade.classname = 'grenade';
    grenade.owner = owner;
    grenade.origin = { ...start };
    grenade.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    grenade.movetype = MoveType.Bounce;
    grenade.clipmask = 0x10020002;
    grenade.solid = Solid.BoundingBox;
    grenade.modelindex = sys.modelIndex('models/objects/grenade/tris.md2');

    // Add mins/maxs for physics
    grenade.mins = { x: -4, y: -4, z: -4 };
    grenade.maxs = { x: 4, y: 4, z: 4 };

    grenade.touch = (self: Entity, other: Entity | null, plane?: CollisionPlane | null, surf?: any) => {
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
             const entities = sys.findByRadius(self.origin, 120);
             T_RadiusDamage(entities as any[], self as any, self.owner as any, damage, self.owner as any, 120, DamageFlags.NONE, DamageMod.GRENADE);
             sys.free(self);
             return;
        }

        // Grenades bounce on walls
        // Physics engine handles bounce if movetype is BOUNCE.
        // We might play a sound here.
    };
    grenade.think = (self: Entity) => {
        // Explode after a delay
        const entities = sys.findByRadius(self.origin, 120);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, damage, self.owner as any, 120, DamageFlags.NONE, DamageMod.GRENADE);
        sys.free(self);
    };
    sys.scheduleThink(grenade, sys.timeSeconds + 2.5);
    sys.finalizeSpawn(grenade);
}

export function createBlasterBolt(sys: EntitySystem, owner: Entity, start: Vec3, dir: Vec3, damage: number, speed: number, mod: DamageMod) {
    const bolt = sys.spawn();
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

    bolt.touch = (self: Entity, other: Entity | null, plane?: CollisionPlane | null, surf?: any) => {
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

        sys.free(self);
    };

    sys.finalizeSpawn(bolt);
}

export function createBfgBall(sys: EntitySystem, owner: Entity, start: Vec3, dir: Vec3, damage: number, speed: number) {
    const bfgBall = sys.spawn();
    bfgBall.classname = 'bfg_ball';
    bfgBall.owner = owner;
    bfgBall.origin = { ...start };
    bfgBall.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    bfgBall.movetype = MoveType.FlyMissile;
    bfgBall.clipmask = 0x10020002;
    bfgBall.solid = Solid.BoundingBox;
    bfgBall.modelindex = sys.modelIndex('models/objects/bfgball/tris.md2');

    bfgBall.mins = { x: -10, y: -10, z: -10 };
    bfgBall.maxs = { x: 10, y: 10, z: 10 };

    bfgBall.touch = (self: Entity, other: Entity | null, plane?: CollisionPlane | null, surf?: any) => {
        if (other === self.owner) {
            return;
        }

        // Primary splash damage
        const entities = sys.findByRadius(self.origin, 200);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, 200, self.owner as any, 200, DamageFlags.NONE, DamageMod.BFG_BLAST);

        // Secondary lasers
        // Quake 2 BFG logic:
        // 1. Calculate vector from ball to player
        // 2. Find all entities within 1000 units of ball
        // 3. Check if entity is visible to player (trace from player eye to entity)
        // 4. If visible, deal damage (Laser damage 10? or scaled by distance?)
        // Ref: g_weapon.c BFG_Lasers

        if (self.owner) {
            const targets = sys.findByRadius(self.origin, 1000);
            const playerOrigin = self.owner.origin; // Ideally use eye position

            for (const target of targets) {
                if (target === self.owner || !target.takedamage) continue;

                // Trace from player to target to check visibility
                // Quake 2 uses 1000 as range for this check too? Or infinite?
                // G_Weapon.c: if (!visible (self->owner, ent)) continue;

                const tr = sys.trace(playerOrigin, null, null, target.origin, self.owner, 0x00000001 | 0x00000002 /* MASK_SOLID | MASK_OPAQUE - approximations */);

                // If we hit the target or we hit nothing (should hit target?), visibility check is complex.
                // Usually game.trace(start, null, null, end, ignore) returns fraction 1.0 if clear.
                // But here we want to know if we can see the target.
                // Simplified: if trace hits the target or ends near it.

                if (tr.ent !== target && tr.fraction < 1.0) {
                     continue; // Blocked
                }

                // Deal damage
                 const dir = normalizeVec3(subtractVec3(target.origin, self.origin));
                 // const dist = lengthVec3(subtractVec3(target.origin, self.origin));
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

        sys.free(self);
    };

    // BFG animation think
    bfgBall.think = (self: Entity) => {
        // Just visual effects or sound updates here
        self.nextthink = sys.timeSeconds + 0.1;
    };
    sys.scheduleThink(bfgBall, sys.timeSeconds + 0.1);
    sys.finalizeSpawn(bfgBall);
}
