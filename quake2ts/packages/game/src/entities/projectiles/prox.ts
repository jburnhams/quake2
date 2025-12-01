// =================================================================
// Quake II - Prox Mine
// =================================================================

import { Entity, Solid, MoveType } from '../entity.js';
import { EntitySystem } from '../system.js';
import { Vec3, ZERO_VEC3, copyVec3, scaleVec3, ServerCommand, TempEntity, normalizeVec3, dotVec3 } from '@quake2ts/shared';
import { T_RadiusDamage } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { DamageMod } from '../../combat/damageMods.js';
import { MulticastType } from '../../imports.js';

// Constants
const PROX_MINE_DAMAGE = 90;
const PROX_MINE_RADIUS = 190;
const PROX_MINE_HEALTH = 1;
const PROX_MINE_DELAY = 1000; // 1 second to arm
const PROX_TRIGGER_RADIUS = 96;

export function createProxMine(
    entities: EntitySystem,
    owner: Entity,
    start: Vec3,
    dir: Vec3,
    speed: number = 600
): Entity {
    const mine = entities.spawn();
    mine.classname = 'prox_mine';
    mine.owner = owner;

    mine.origin = copyVec3(start);
    mine.velocity = scaleVec3(dir, speed);

    mine.movetype = MoveType.Toss;
    mine.solid = Solid.BoundingBox;
    mine.clipmask = 0x20000000 | 0x00000001; // MASK_SHOT | MASK_SOLID

    mine.mins = { x: -4, y: -4, z: -4 };
    mine.maxs = { x: 4, y: 4, z: 4 };

    mine.modelindex = entities.modelIndex("models/objects/grenade2/tris.md2");

    const proxMineExplode = (self: Entity) => {
        const targets = Array.from(entities.findByRadius(self.origin, PROX_MINE_RADIUS));
        T_RadiusDamage(
            targets as any[],
            self as any,
            self.owner as any,
            PROX_MINE_DAMAGE,
            self as any,
            PROX_MINE_RADIUS,
            DamageFlags.NONE,
            DamageMod.PROX,
            entities.timeSeconds,
            {},
            entities.multicast.bind(entities)
        );

        entities.multicast(self.origin, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.ROCKET_EXPLOSION, self.origin);
        entities.free(self);
    };

    const proxMineThink = (self: Entity) => {
        if (!self.owner) {
            entities.free(self);
            return;
        }

        const nearby = entities.findByRadius(self.origin, PROX_TRIGGER_RADIUS);
        let trigger = false;

        for (const ent of nearby) {
            if (!ent.takedamage) continue;
            if (ent === self.owner) continue;

            if (ent.health > 0) {
                trigger = true;
                break;
            }
        }

        if (trigger) {
            proxMineExplode(self);
            return;
        }

        self.nextthink = entities.timeSeconds + 0.1;
    };

    const proxMineTouch = (self: Entity, other: Entity | null, plane?: { normal: Vec3 }, surf?: any) => {
        if (surf && (surf.flags & 4)) {
            entities.free(self);
            return;
        }

        if (other && other.takedamage) {
            proxMineExplode(self);
            return;
        }

        if (self.movetype === MoveType.Toss) {
            self.movetype = MoveType.None;
            self.solid = Solid.BoundingBox;
            self.velocity = ZERO_VEC3;

            entities.sound(self, 0, "weapons/prox_land.wav", 1, 1, 0);

            self.think = proxMineThink;
            self.nextthink = entities.timeSeconds + (PROX_MINE_DELAY / 1000);

            self.health = PROX_MINE_HEALTH;
            self.takedamage = true;
            self.die = (ent, inflictor, attacker, damage, point) => {
                 proxMineExplode(ent);
            };
        }
    };

    mine.touch = proxMineTouch;

    entities.linkentity(mine);

    return mine;
}
