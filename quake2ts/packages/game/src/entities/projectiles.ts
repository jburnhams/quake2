// =================================================================
// Quake II - Projectile Entities
// =================================================================

import { Entity, MoveType, Solid } from './entity.js';
import { EntitySystem } from './system.js';
import { T_Damage, T_RadiusDamage } from '../combat/damage.js';
import { DamageFlags } from '../combat/damageFlags.js';
import { DamageMod } from '../combat/damageMods.js';
import { ZERO_VEC3, lengthVec3, subtractVec3, normalizeVec3, Vec3, CollisionPlane, ServerCommand, TempEntity } from '@quake2ts/shared';
import { MulticastType } from '../imports.js';

export function createRocket(sys: EntitySystem, owner: Entity, start: Vec3, dir: Vec3, damage: number, radiusDamage: number, speed: number, flashtype: number = 0) {
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
                DamageMod.ROCKET,
                sys.multicast.bind(sys)
            );
        }

        const entities = sys.findByRadius(self.origin, 120);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, radiusDamage, self.owner as any, 120, DamageFlags.NONE, DamageMod.R_SPLASH, {}, sys.multicast.bind(sys));

        // Explosion effect
        sys.multicast(self.origin, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.ROCKET_EXPLOSION, self.origin);

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

    const explode = (self: Entity) => {
        const entities = sys.findByRadius(self.origin, 120);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, damage, self.owner as any, 120, DamageFlags.NONE, DamageMod.GRENADE, {}, sys.multicast.bind(sys));

        // Explosion effect
        sys.multicast(self.origin, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.GRENADE_EXPLOSION, self.origin);

        sys.free(self);
    };

    grenade.touch = (self: Entity, other: Entity | null, plane?: CollisionPlane | null, surf?: any) => {
        if (other === self.owner) {
            return;
        }

        // Explode immediately if hitting a damageable entity (monster/player)
        if (other && other.takedamage) {
            // Deal direct damage part handled by radius usually?
            // Quake 2: grenade touches -> Grenade_Explode -> T_RadiusDamage
            // But if it hits a monster directly, it stops and explodes.
            explode(self);
            return;
        }

        // Grenades bounce on walls
        // Physics engine handles bounce if movetype is BOUNCE.
        // We might play a sound here.
    };
    grenade.think = (self: Entity) => {
        explode(self);
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
                mod,
                sys.multicast.bind(sys)
            );
        } else {
            // Wall impact effect
            if (plane) {
                sys.multicast(self.origin, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.BLASTER, self.origin, plane.normal);
            }
        }

        sys.free(self);
    };

    sys.finalizeSpawn(bolt);
}

export function createBfgBall(sys: EntitySystem, owner: Entity, start: Vec3, dir: Vec3, damage: number, speed: number, damageRadius: number) {
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

    const bfgExplode = (self: Entity) => {
        if (self.owner) {
            const targets = sys.findByRadius(self.origin, 1000);
            const playerOrigin = self.owner.origin; // Ideally use eye position

            for (const target of targets) {
                if (target === self.owner || !target.takedamage) continue;

                const tr = sys.trace(playerOrigin, null, null, target.origin, self.owner, 0x00000001 | 0x00000002);

                if (tr.ent !== target && tr.fraction < 1.0) {
                    continue; // Blocked
                }

                // Deal damage
                const dir = normalizeVec3(subtractVec3(target.origin, self.origin));
                let laserDamage = 10;

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
                    DamageMod.BFG_LASER,
                    sys.multicast.bind(sys)
                );

                // Laser effect
                sys.multicast(self.origin, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.BFG_LASER, playerOrigin, target.origin);
            }
        }

        self.frame++;
        if (self.frame === 5) {
            sys.free(self);
        } else {
            sys.scheduleThink(self, sys.timeSeconds + 0.1);
        }
    };

    bfgBall.touch = (self: Entity, other: Entity | null, plane?: CollisionPlane | null, surf?: any) => {
        if (other === self.owner) {
            return;
        }

        // Primary splash damage
        T_RadiusDamage(sys.findByRadius(self.origin, damageRadius) as any[], self as any, self.owner as any, damage, self.owner as any, damageRadius, DamageFlags.NONE, DamageMod.BFG_BLAST, {}, sys.multicast.bind(sys));

        // Explosion effect
        sys.multicast(self.origin, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.BFG_EXPLOSION, self.origin);

        self.solid = Solid.Not;
        self.touch = undefined;
        self.velocity = ZERO_VEC3;
        self.think = bfgExplode;
        self.frame = 0;
        sys.scheduleThink(self, sys.timeSeconds + 0.1);
    };

    // BFG in-flight laser think
    bfgBall.think = (self: Entity) => {
        const damage = 10; // TODO: Check deathmatch flag for 5 damage
        const BFG_LASER_RADIUS = 256;

        // Find nearby entities
        const targets = sys.findByRadius(self.origin, BFG_LASER_RADIUS);

        for (const target of targets) {
            if (target === self || target === self.owner || !target.takedamage) {
                continue;
            }

            // Check line of sight to the center of the target
            const targetCenter = {
                x: target.origin.x,
                y: target.origin.y,
                z: target.origin.z + (target.mins.z + target.maxs.z) / 2
            };

            const tr = sys.trace(self.origin, null, null, targetCenter, self, 0x00000001 /* MASK_SOLID */);

            if (tr.fraction < 1.0 && tr.ent !== target) {
                continue; // Blocked by world or another entity
            }

            // Deal damage
            const dir = normalizeVec3(subtractVec3(target.origin, self.origin));
            T_Damage(
                target as any,
                self as any,
                self.owner as any,
                dir,
                target.origin,
                ZERO_VEC3,
                damage,
                1, // knockback
                DamageFlags.ENERGY,
                DamageMod.BFG_LASER,
                sys.multicast.bind(sys)
            );

            // Laser effect from BFG ball to target
            sys.multicast(self.origin, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.BFG_LASER, self.origin, target.origin);
        }

        sys.scheduleThink(self, sys.timeSeconds + 0.1);
    };
    sys.scheduleThink(bfgBall, sys.timeSeconds + 0.1);
    sys.finalizeSpawn(bfgBall);
    return bfgBall;
}
