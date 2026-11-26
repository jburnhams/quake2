// =================================================================
// Quake II - Prox Mine
// =================================================================

import { Entity, Solid, MoveType, CollisionSurface } from '../entity.js';
import { EntitySystem } from '../system.js';
import { Vec3, ZERO_VEC3, copyVec3, scaleVec3, ServerCommand, TempEntity, normalizeVec3, dotVec3, addVec3, MASK_SHOT, CollisionPlane } from '@quake2ts/shared';
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
const MAX_PROX_MINES = 50; // Max mines per player (Rogue)

export function createProxMine(
    entities: EntitySystem,
    owner: Entity,
    start: Vec3,
    dir: Vec3,
    speed: number = 600
): Entity {
    // Limit check: Enforce MAX_PROX_MINES per player
    const existingMines = entities.findByClassname('prox_mine').filter(e => e.owner === owner);
    if (existingMines.length >= MAX_PROX_MINES) {
        existingMines.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const oldest = existingMines[0];
        if (oldest) {
            entities.free(oldest);
        }
    }

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

    mine.movedir = { x: 0, y: 0, z: 1 };

    const proxMineExplode = (self: Entity) => {
        // Prevent recursion if T_RadiusDamage damages the mine itself
        self.takedamage = false;
        self.health = 0;
        self.deadflag = 2; // DeadFlag.Dead

        // console.log('DEBUG: proxMineExplode called');
        const targets = Array.from(entities.findByRadius(self.origin, PROX_MINE_RADIUS));
        // console.log('DEBUG: targets found:', targets.length);
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
        // console.log('DEBUG: proxMineThink running');
        if (!self.owner) {
            entities.free(self);
            return;
        }

        // 1. Proximity Trigger
        const nearby = entities.findByRadius(self.origin, PROX_TRIGGER_RADIUS);
        let trigger = false;

        for (const ent of nearby) {
            if (!ent.takedamage) continue;
            if (ent === self.owner) continue;
            if (ent === self) continue; // Ignore self

            if (ent.health > 0) {
                trigger = true;
                break;
            }
        }
        // console.log('DEBUG: Proximity check result:', trigger);

        // 2. Laser Tripwire Trigger
        if (!trigger && self.movedir) {
            // Beam extends 2048 units along movedir (normal)
            const beamEnd = addVec3(self.origin, scaleVec3(self.movedir, 2048));

            const trace = entities.trace(self.origin, null, null, beamEnd, self, MASK_SHOT);
            // console.log('DEBUG: Trace result:', trace.ent ? 'hit' : 'miss', trace.ent?.classname);

            if (trace.ent && trace.ent.takedamage && trace.ent !== self.owner) {
                trigger = true;
                // console.log('DEBUG: Trace trigger!');
            }
        }

        if (trigger) {
            proxMineExplode(self);
            return;
        }

        self.nextthink = entities.timeSeconds + 0.1;
        entities.scheduleThink(self, self.nextthink);
    };

    const proxMineTouch = (self: Entity, other: Entity | null, plane?: CollisionPlane | null, surf?: CollisionSurface | null) => {
        if (surf && (surf.flags & 4)) { // SURF_SKY
            entities.free(self);
            return;
        }

        if (other && other.takedamage) {
            if (other === self.owner) return; // Don't explode on owner

            proxMineExplode(self);
            return;
        }

        if (self.movetype === MoveType.Toss) {
            self.movetype = MoveType.None;
            self.solid = Solid.BoundingBox;
            self.velocity = ZERO_VEC3;

            if (plane && plane.normal) {
                self.movedir = copyVec3(plane.normal);
            } else {
                 self.movedir = { x: 0, y: 0, z: 1 }; // Default Up
            }

            entities.sound(self, 0, "weapons/prox_land.wav", 1, 1, 0);

            self.think = proxMineThink;
            self.nextthink = entities.timeSeconds + (PROX_MINE_DELAY / 1000);
            entities.scheduleThink(self, self.nextthink);

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
