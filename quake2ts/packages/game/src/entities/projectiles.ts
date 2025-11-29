// =================================================================
// Quake II - Projectile Entities
// =================================================================

import { Entity, MoveType, Solid, ServerFlags } from './entity.js';
import { EntitySystem } from './system.js';
import { T_Damage, T_RadiusDamage } from '../combat/damage.js';
import { DamageFlags } from '../combat/damageFlags.js';
import { DamageMod } from '../combat/damageMods.js';
import { ZERO_VEC3, lengthVec3, subtractVec3, normalizeVec3, Vec3, CollisionPlane, ServerCommand, TempEntity, CONTENTS_SOLID, CONTENTS_MONSTER, CONTENTS_PLAYER, CONTENTS_DEADMONSTER, MASK_SOLID, vectorToAngles } from '@quake2ts/shared';
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
                sys.timeSeconds,
                sys.multicast.bind(sys)
            );
        }

        const entities = sys.findByRadius(self.origin, 120);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, radiusDamage, self.owner as any, 120, DamageFlags.NONE, DamageMod.R_SPLASH, sys.timeSeconds, {}, sys.multicast.bind(sys));

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
        T_RadiusDamage(entities as any[], self as any, self.owner as any, damage, self.owner as any, 120, DamageFlags.NONE, DamageMod.GRENADE, sys.timeSeconds, {}, sys.multicast.bind(sys));

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
    if (mod === DamageMod.HYPERBLASTER) {
        bolt.classname = 'hyperblaster_bolt';
    } else if (mod === DamageMod.BLUEBLASTER) {
        bolt.classname = 'blueblaster_bolt';
        bolt.modelindex = sys.modelIndex('models/objects/laser/tris.md2');
        bolt.skin = 1;
        // Effect for blue blaster (e.g. EF_BLUEHYPERBLASTER) should be set if available in engine effects
        // Or renderfx?
        // Using TempEntity.BLUEHYPERBLASTER for impact.
    } else {
        bolt.classname = 'blaster_bolt';
    }

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
                sys.timeSeconds,
                sys.multicast.bind(sys)
            );
        } else {
            // Wall impact effect
            if (plane) {
                let impactEffect = TempEntity.BLASTER;
                if (mod === DamageMod.BLUEBLASTER) {
                    impactEffect = TempEntity.BLUEHYPERBLASTER;
                }
                sys.multicast(self.origin, MulticastType.Pvs, ServerCommand.temp_entity, impactEffect, self.origin, plane.normal);
            }
        }

        sys.free(self);
    };

    sys.finalizeSpawn(bolt);
}

export function createIonRipper(sys: EntitySystem, owner: Entity, start: Vec3, dir: Vec3, damage: number, speed: number) {
    const ion = sys.spawn();
    ion.classname = 'ionripper';
    ion.owner = owner;
    ion.origin = { ...start };
    ion.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    ion.movetype = MoveType.WallBounce;
    ion.solid = Solid.BoundingBox;
    ion.modelindex = sys.modelIndex('models/objects/boomrang/tris.md2');

    // Set up collision box (same as rocket/blaster size usually?)
    // C++ source doesn't explicitly set mins/maxs for ionripper in fire_ionripper snippet,
    // but G_Spawn clears them. Defaults are often 0.
    // However, for reliable physics, a small box is good.
    ion.mins = { x: -2, y: -2, z: -2 };
    ion.maxs = { x: 2, y: 2, z: 2 };

    // Effects
    // ion.effects |= EF_IONRIPPER? No such flag in standard Q2.
    // Likely handled by model or renderfx.
    // m_soldier.cpp uses EF_IONRIPPER. This might be a rogue/xatrix specific flag.
    // We'll skip setting unknown flags and rely on model.

    ion.touch = (self: Entity, other: Entity | null, plane?: CollisionPlane | null, surf?: any) => {
        if (other === self.owner) {
            return;
        }

        // C++: if (other->takedamage) T_Damage... G_FreeEdict...
        if (other && other.takedamage) {
             T_Damage(
                other as any,
                self as any,
                self.owner as any,
                self.velocity,
                self.origin,
                plane ? plane.normal : ZERO_VEC3,
                damage,
                1,
                DamageFlags.ENERGY,
                DamageMod.RIPPER,
                sys.timeSeconds,
                sys.multicast.bind(sys)
            );
            sys.free(self);
            return;
        }

        // Hit wall/sky?
        // C++: if (tr.surface && (tr.surface->flags & SURF_SKY)) G_FreeEdict...
        // We don't have surface flags easily accessible in touch yet, but physics might handle sky.
        // For now, if it hits a wall, WallBounce physics will reflect it.

        // Play bounce sound? C++ doesn't show explicit bounce sound in touch,
        // but it might play on impact if handled by engine or configured.
        // We can add a sound here if needed.
    };

    ion.think = (self: Entity) => {
        // C++: ionripper_sparks (TE_WELDING_SPARKS)
        sys.multicast(self.origin, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.WELDING_SPARKS, self.origin, ZERO_VEC3, 0xe4); // 0xe4 is typical color byte?
        sys.free(self);
    };

    sys.scheduleThink(ion, sys.timeSeconds + 3.0); // 3 seconds lifetime
    sys.finalizeSpawn(ion);
}

export function createBlueBlaster(sys: EntitySystem, owner: Entity, start: Vec3, dir: Vec3, damage: number, speed: number) {
    createBlasterBolt(sys, owner, start, dir, damage, speed, DamageMod.BLUEBLASTER);
}

/**
 * Helper function to fire a piercing BFG laser that can go through multiple entities.
 * Based on rerelease/g_weapon.cpp:1028-1068 (bfg_laser_pierce_t)
 *
 * @param sys Entity system
 * @param bfg The BFG projectile entity
 * @param target The target entity to fire at
 * @param damage Damage per hit (5 in deathmatch, 10 in single player)
 */
function fireBfgPiercingLaser(sys: EntitySystem, bfg: Entity, target: Entity, damage: number): void {
    const start = { ...bfg.origin };
    const targetCenter: Vec3 = {
        x: (target.absmin.x + target.absmax.x) * 0.5,
        y: (target.absmin.y + target.absmax.y) * 0.5,
        z: (target.absmin.z + target.absmax.z) * 0.5,
    };

    const dir = normalizeVec3(subtractVec3(targetCenter, start));
    const end: Vec3 = {
        x: start.x + dir.x * 2048,
        y: start.y + dir.y * 2048,
        z: start.z + dir.z * 2048,
    };

    // Piercing laser - continues through multiple entities
    // Based on pierce_trace in rerelease/g_weapon.cpp:88-111
    const MAX_PIERCE = 16;
    const pierced: Entity[] = [];
    const piercedSolidities: Solid[] = [];
    let currentStart = { ...start };

    try {
        for (let i = 0; i < MAX_PIERCE; i++) {
            const tr = sys.trace(currentStart, null, null, end, bfg,
                CONTENTS_SOLID | CONTENTS_MONSTER | CONTENTS_PLAYER | CONTENTS_DEADMONSTER
            );

            // Nothing hit, we're done
            if (!tr.ent || tr.fraction >= 1.0) {
                break;
            }

            // Damage the entity if it can take damage
            // Based on rerelease/g_weapon.cpp:1046-1048
            if (tr.ent.takedamage && tr.ent !== bfg.owner) {
                T_Damage(
                    tr.ent as any,
                    bfg as any,
                    bfg.owner as any,
                    dir,
                    tr.endpos,
                    ZERO_VEC3,
                    damage,
                    1, // kick
                    DamageFlags.ENERGY,
                    DamageMod.BFG_LASER,
                    sys.timeSeconds,
                    sys.multicast.bind(sys)
                );
            }

            // Stop if we hit something that's not a monster/player/client
            // Based on rerelease/g_weapon.cpp:1050-1061
            if (!(tr.ent.svflags & ServerFlags.Monster) &&
                !(tr.ent.client) &&
                tr.ent.classname !== 'misc_explobox') {
                // Laser sparks effect for wall hits (would need TE_LASER_SPARKS if available)
                break;
            }

            // Mark entity as pierced by temporarily making it non-solid
            pierced.push(tr.ent);
            piercedSolidities.push(tr.ent.solid);
            tr.ent.solid = Solid.Not;

            // Continue from hit point
            currentStart = { ...tr.endpos };
        }

        // Visual laser effect
        // Based on rerelease/g_weapon.cpp:1130-1134
        const finalTrace = sys.trace(start, null, null, end, bfg, CONTENTS_SOLID);
        sys.multicast(bfg.origin, MulticastType.Phs, ServerCommand.temp_entity,
            TempEntity.BFG_LASER, start, finalTrace.endpos);
    } finally {
        // Always restore solidities, even if an error occurred
        for (let i = 0; i < pierced.length; i++) {
            pierced[i].solid = piercedSolidities[i];
        }
    }
}

/**
 * BFG think function - fires lasers during flight every 100ms
 * Based on rerelease/g_weapon.cpp:1070-1138 (bfg_think)
 */
function bfgThink(self: Entity, sys: EntitySystem): void {
    // Determine damage based on deathmatch mode
    // In deathmatch: 5 damage, single player: 10 damage
    // Based on rerelease/g_weapon.cpp:1080-1083
    const dmg = sys.deathmatch ? 5 : 10;

    // Find all entities within 256 units
    // Based on rerelease/g_weapon.cpp:1088
    const nearbyEntities = sys.findByRadius(self.origin, 256);

    for (const ent of nearbyEntities) {
        // Skip self and owner
        // Based on rerelease/g_weapon.cpp:1090-1094
        if (ent === self || ent === self.owner) {
            continue;
        }

        // Skip entities that can't take damage
        // Based on rerelease/g_weapon.cpp:1096-1097
        if (!ent.takedamage) {
            continue;
        }

        // Only target monsters, players, exploboxes
        // Based on rerelease/g_weapon.cpp:1099-1101
        if (!(ent.svflags & ServerFlags.Monster) &&
            !ent.client &&
            ent.classname !== 'misc_explobox') {
            continue;
        }

        // Calculate entity center point
        // Based on rerelease/g_weapon.cpp:1108
        const point: Vec3 = {
            x: (ent.absmin.x + ent.absmax.x) * 0.5,
            y: (ent.absmin.y + ent.absmax.y) * 0.5,
            z: (ent.absmin.z + ent.absmax.z) * 0.5,
        };

        // Check line of sight from BFG to entity center
        // Don't fire laser if blocked by world
        // Based on rerelease/g_weapon.cpp:1116-1120
        const sightTrace = sys.trace(self.origin, null, null, point, null, MASK_SOLID);
        if (sightTrace.fraction < 1.0) {
            continue; // Blocked by world
        }

        // Fire piercing laser at this entity
        // Based on rerelease/g_weapon.cpp:1122-1128
        fireBfgPiercingLaser(sys, self, ent, dmg);
    }

    // Reschedule think for 100ms later (10 Hz)
    // Based on rerelease/g_weapon.cpp:1137
    sys.scheduleThink(self, sys.timeSeconds + 0.1);
}

/**
 * BFG explosion think function - fires lasers over multiple frames
 * Based on rerelease/g_weapon.cpp:933-987 (bfg_explode)
 */
function bfgExplode(self: Entity, sys: EntitySystem): void {
    // Initialize frame counter if not set
    if (self.frame === undefined || self.frame < 0) {
        self.frame = 0;
    }

    // On first frame, do the BFG effect damage
    // Based on rerelease/g_weapon.cpp:942-981
    if (self.frame === 0) {
        const entities = sys.findByRadius(self.origin, self.dmg_radius || 100);

        for (const ent of entities) {
            if (!ent.takedamage) continue;
            if (ent === self.owner) continue;

            // Check if we can damage this entity
            // Based on rerelease/g_weapon.cpp:952-963
            if (!(ent.svflags & ServerFlags.Monster) &&
                !ent.client &&
                ent.classname !== 'misc_explobox') {
                continue;
            }

            const centroid: Vec3 = {
                x: (ent.absmin.x + ent.absmax.x) * 0.5,
                y: (ent.absmin.y + ent.absmax.y) * 0.5,
                z: (ent.absmin.z + ent.absmax.z) * 0.5,
            };

            const delta = subtractVec3(self.origin, centroid);
            const dist = lengthVec3(delta);
            const dmgRadius = self.dmg_radius || 100;
            const points = (self.radius_dmg || 200) * (1.0 - Math.sqrt(dist / dmgRadius));

            if (points > 0) {
                T_Damage(
                    ent as any,
                    self as any,
                    self.owner as any,
                    self.velocity,
                    centroid,
                    ZERO_VEC3,
                    Math.floor(points),
                    0,
                    DamageFlags.ENERGY,
                    DamageMod.BFG_EFFECT,
                    sys.timeSeconds,
                    sys.multicast.bind(sys)
                );

                // Visual BFG zap effect (would need TE_BFG_ZAP if available)
            }
        }
    }

    // Continue explosion over 5 frames
    // Based on rerelease/g_weapon.cpp:983-986
    self.frame++;
    if (self.frame >= 5) {
        sys.free(self);
        return;
    }

    // Schedule next frame at 10 Hz (100ms)
    sys.scheduleThink(self, sys.timeSeconds + 0.1);
}

export function createBfgBall(sys: EntitySystem, owner: Entity, start: Vec3, dir: Vec3, damage: number, speed: number, damageRadius: number) {
    const bfgBall = sys.spawn();
    bfgBall.classname = 'bfg blast';
    bfgBall.owner = owner;
    bfgBall.origin = { ...start };
    bfgBall.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    bfgBall.movetype = MoveType.FlyMissile;
    bfgBall.clipmask = 0x10020002; // MASK_PROJECTILE
    bfgBall.solid = Solid.BoundingBox;
    bfgBall.modelindex = sys.modelIndex('sprites/s_bfg1.sp2');
    bfgBall.svflags = ServerFlags.Projectile;

    // Store damage values for explosion
    bfgBall.radius_dmg = damage;
    bfgBall.dmg_radius = damageRadius;

    bfgBall.mins = { x: -10, y: -10, z: -10 };
    bfgBall.maxs = { x: 10, y: 10, z: 10 };

    // Touch handler for when BFG hits something
    // Based on rerelease/g_weapon.cpp:989-1025 (bfg_touch)
    bfgBall.touch = (self: Entity, other: Entity | null, plane?: CollisionPlane | null, surf?: any) => {
        if (other === self.owner) {
            return;
        }

        // Core explosion - prevents firing into wall/floor
        // Based on rerelease/g_weapon.cpp:1003-1006
        if (other && other.takedamage) {
            T_Damage(
                other as any,
                self as any,
                self.owner as any,
                self.velocity,
                self.origin,
                plane ? plane.normal : ZERO_VEC3,
                200,
                0,
                DamageFlags.ENERGY,
                DamageMod.BFG_BLAST,
                sys.timeSeconds,
                sys.multicast.bind(sys)
            );
        }

        // Radius damage from initial impact
        const entities = sys.findByRadius(self.origin, 100);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, 200, other as any, 100,
            DamageFlags.ENERGY, DamageMod.BFG_BLAST, sys.timeSeconds, {}, sys.multicast.bind(sys));

        // Big explosion effect
        // Based on rerelease/g_weapon.cpp:1021-1024
        sys.multicast(self.origin, MulticastType.Phs, ServerCommand.temp_entity,
            TempEntity.BFG_BIGEXPLOSION, self.origin);

        // Change to explosion sprite and set up multi-frame explosion
        // Based on rerelease/g_weapon.cpp:1009-1019
        self.solid = Solid.Not;
        self.touch = undefined;
        self.velocity = ZERO_VEC3;
        self.modelindex = sys.modelIndex('sprites/s_bfg3.sp2');
        self.frame = 0;
        self.enemy = other;

        // Start multi-frame explosion with laser effects
        self.think = (self: Entity, context: any) => bfgExplode(self, context);
        sys.scheduleThink(self, sys.timeSeconds + 0.1);
    };

    // Set up in-flight laser think function
    // Based on rerelease/g_weapon.cpp:1166-1167
    bfgBall.think = (self: Entity, context: any) => bfgThink(self, context);

    // Start thinking immediately (FRAME_TIME_S)
    // Based on rerelease/g_weapon.cpp:1167
    sys.scheduleThink(bfgBall, sys.timeSeconds + 0.016); // ~1 frame

    sys.finalizeSpawn(bfgBall);
}
