// =================================================================
// Quake II - Projectile Entities
// =================================================================

import { Entity, MoveType, Solid } from './entity.js';
import { EntitySystem } from './system.js';
import { T_Damage, T_RadiusDamage, Damageable } from '../combat/damage.js';
import { DamageFlags } from '../combat/damageFlags.js';
import { ZERO_VEC3 } from '@quake2ts/shared';
import { DamageMod } from '../combat/damageMods.js';

export function createRocket(sys: EntitySystem, owner: Entity, start: any, dir: any, damage: number, speed: number) {
    const rocket = sys.spawn();
    rocket.classname = 'rocket';
    rocket.movetype = MoveType.FlyMissile;
    rocket.solid = Solid.BoundingBox;
    rocket.owner = owner;
    rocket.origin = { ...start };
    rocket.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    rocket.mins = { x: -4, y: -4, z: -4 };
    rocket.maxs = { x: 4, y: 4, z: 4 };
    rocket.touch = (self, other) => {
        if (other === self.owner) {
            return;
        }

        const entities = sys.findByRadius(self.origin, 120);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, damage, self.owner as any, 120, 0, DamageMod.R_SPLASH);

        sys.free(self);
    };

    sys.finalizeSpawn(rocket);
}

export function createGrenade(sys: EntitySystem, owner: Entity, start: any, dir: any, damage: number, speed: number) {
    const grenade = sys.spawn();
    grenade.classname = 'grenade';
    grenade.owner = owner;
    grenade.origin = { ...start };
    grenade.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    grenade.movetype = MoveType.Bounce;
    grenade.clipmask = 0x10020002;
    grenade.solid = Solid.BoundingBox;
    grenade.modelindex = sys.modelIndex('models/objects/grenade/tris.md2');
    grenade.touch = (self, other) => {
        if (other === self.owner) {
            return;
        }
    };
    grenade.think = (self) => {
        // Explode after a delay
        const entities = sys.findByRadius(self.origin, 120);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, damage, self.owner as any, 120, 0, DamageMod.G_SPLASH);
        sys.free(self);
    };
    sys.scheduleThink(grenade, sys.timeSeconds + 2.5);
    sys.finalizeSpawn(grenade);
}

export function createBfgBall(sys: EntitySystem, owner: Entity, start: any, dir: any, damage: number, speed: number) {
    const bfgBall = sys.spawn();
    bfgBall.classname = 'bfg_ball';
    bfgBall.owner = owner;
    bfgBall.origin = { ...start };
    bfgBall.velocity = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    bfgBall.movetype = MoveType.FlyMissile;
    bfgBall.clipmask = 0x10020002;
    bfgBall.solid = Solid.BoundingBox;
    bfgBall.modelindex = sys.modelIndex('models/objects/bfgball/tris.md2');
    bfgBall.touch = (self, other) => {
        if (other === self.owner) {
            return;
        }

        const entities = sys.findByRadius(self.origin, 120);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, damage, self.owner as any, 120, 0, DamageMod.BFG_BLAST);

        sys.free(self);
    };
    bfgBall.think = (self) => {
        const entities = sys.findByRadius(self.origin, 1000);

        for (const entity of entities) {
            if (entity === self.owner || !entity.takedamage) {
                continue;
            }

            const trace = sys.trace(self.origin, null, null, entity.origin, self, 0);
            if (trace.ent === entity) {
                T_Damage(entity as any, self as any, self.owner as any, ZERO_VEC3, trace.endpos, ZERO_VEC3, 1, 0, DamageFlags.NONE, DamageMod.BFG_LASER);
            }
        }

        self.nextthink = sys.timeSeconds + 0.1;
    };
    sys.scheduleThink(bfgBall, sys.timeSeconds + 0.1);
    sys.finalizeSpawn(bfgBall);
}
