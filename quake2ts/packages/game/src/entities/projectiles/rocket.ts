// =================================================================
// Quake II - Projectile Entities: Rocket (Refactored)
// =================================================================

import { Entity, MoveType, Solid } from '../entity.js';
import { EntitySystem } from '../system.js';
import { T_Damage, T_RadiusDamage } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { DamageMod } from '../../combat/damageMods.js';
import { ZERO_VEC3, Vec3, CollisionPlane, ServerCommand, TempEntity } from '@quake2ts/shared';
import { MulticastType } from '../../imports.js';

export function createRocket(sys: EntitySystem, owner: Entity, start: Vec3, dir: Vec3, damage: number, speed: number, radiusDamage?: number, damageFlag: DamageFlags = DamageFlags.NONE) {
    const rocket = sys.spawn();
    rocket.classname = 'rocket';
    rocket.movetype = MoveType.FlyMissile;
    rocket.solid = Solid.BoundingBox;
    rocket.owner = owner;
    rocket.origin = { ...start };
    rocket.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    rocket.mins = { x: -4, y: -4, z: -4 };
    rocket.maxs = { x: 4, y: 4, z: 4 };
    rocket.effects = 0; // EF_ROCKET typically handled by engine/client

    // We need to be careful about sound. Projectiles usually have soundIndex.
    // sys.sound(rocket, 0, 'weapons/rockfly.wav', 1, 1); // Loop sound?

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
                damageFlag,
                DamageMod.ROCKET,
                sys.multicast.bind(sys)
            );
        }

        const damageRadius = radiusDamage || 120;
        const entities = sys.findByRadius(self.origin, damageRadius);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, damageRadius, self.owner as any, damageRadius, damageFlag, DamageMod.R_SPLASH, {}, sys.multicast.bind(sys));

        // Explosion effect
        sys.multicast(self.origin, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.ROCKET_EXPLOSION, self.origin);

        sys.free(self);
    };

    sys.finalizeSpawn(rocket);
}
