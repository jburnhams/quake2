// =================================================================
// Quake II - Projectile Entities
// =================================================================

import { Entity, MoveType, Solid } from './entity.js';
import { GameExports } from '../index.js';
import { T_Damage, T_RadiusDamage, Damageable } from '../combat/damage.js';
import { DamageFlags } from '../combat/damageFlags.js';
import { ZERO_VEC3 } from '@quake2ts/shared';

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
    rocket.touch = (self, other) => {
        if (other === self.owner) {
            return;
        }

        const entities = game.entities.findByRadius(self.origin, 120);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, damage, self.owner as any, 120, 0, 0);

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
    grenade.touch = (self, other) => {
        if (other === self.owner) {
            return;
        }
    };
    grenade.think = (self) => {
        // Explode after a delay
        const entities = game.entities.findByRadius(self.origin, 120);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, damage, self.owner as any, 120, 0, 0);
        game.entities.free(self);
    };
    game.entities.scheduleThink(grenade, game.time + 2.5);
    game.entities.finalizeSpawn(grenade);
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
    bfgBall.touch = (self, other) => {
        if (other === self.owner) {
            return;
        }

        const entities = game.entities.findByRadius(self.origin, 120);
        T_RadiusDamage(entities as any[], self as any, self.owner as any, damage, self.owner as any, 120, 0, 0);

        game.entities.free(self);
    };
    bfgBall.think = (self) => {
        const entities = game.entities.findByRadius(self.origin, 1000);

        for (const entity of entities) {
            if (entity === self.owner || !entity.takedamage) {
                continue;
            }

            const trace = game.trace(self.origin, null, null, entity.origin, self, 0);
            if (trace.ent === entity) {
                T_Damage(entity as any, self as any, self.owner as any, ZERO_VEC3, trace.endpos, ZERO_VEC3, 1, 0, DamageFlags.NONE, 0);
            }
        }

        self.nextthink = game.time + 0.1;
    };
    game.entities.scheduleThink(bfgBall, game.time + 0.1);
    game.entities.finalizeSpawn(bfgBall);
}
