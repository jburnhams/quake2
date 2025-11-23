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

        // Explosion effect
        // gi.WriteByte (svc_temp_entity);
        // gi.WriteByte (TE_ROCKET_EXPLOSION);
        // gi.WritePosition (self->s.origin);
        // gi.multicast (self->s.origin, MULTICAST_PHS);
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
        T_RadiusDamage(entities as any[], self as any, self.owner as any, damage, self.owner as any, 120, DamageFlags.NONE, DamageMod.GRENADE);

        // Explosion effect
        // gi.WriteByte (svc_temp_entity);
        // gi.WriteByte (TE_GRENADE_EXPLOSION);
        // gi.WritePosition (self->s.origin);
        // gi.multicast (self->s.origin, MULTICAST_PHS);
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

    // Light and effects are client-side usually, but we might want to set EF_BLASTER flag?
    // Quake 2 uses EF_BLASTER or EF_HYPERBLASTER on entity effects.
    // if (weapon == WEAPON_HYPERBLASTER) bolt->s.effects |= EF_HYPERBLASTER;
    // else bolt->s.effects |= EF_BLASTER;
    // We need EntityEffects enum. Assuming it matches.
    // 0x00000008 = EF_BLASTER
    // 0x00001000 = EF_HYPERBLASTER (maybe?)
    // Let's just use TempEntities on impact for now.

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
            // gi.WriteByte (svc_temp_entity);
            // gi.WriteByte (TE_BLASTER);
            // gi.WritePosition (self->s.origin);
            // gi.WriteDir (plane->normal);
            // gi.multicast (self->s.origin, MULTICAST_PVS);
            if (plane) {
                sys.multicast(self.origin, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.BLASTER, self.origin, plane.normal);
            }
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

        // Explosion effect
        sys.multicast(self.origin, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.BFG_EXPLOSION, self.origin);

        // Secondary lasers
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
                    DamageMod.BFG_LASER
                );

                // Laser effect? TE_BFG_LASER
                // gi.WriteByte (svc_temp_entity);
                // gi.WriteByte (TE_BFG_LASER);
                // gi.WritePosition (self->owner->s.origin);
                // gi.WritePosition (ent->s.origin);
                // gi.multicast (self->s.origin, MULTICAST_PHS);
                sys.multicast(self.origin, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.BFG_LASER, playerOrigin, target.origin);
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
