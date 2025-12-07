// =================================================================
// Quake II - Prox Mine
// =================================================================

import { Entity, Solid, MoveType, EntityFlags } from '../entity.js';
import { EntitySystem } from '../system.js';
import { Vec3, ZERO_VEC3, copyVec3, scaleVec3, ServerCommand, TempEntity, normalizeVec3, dotVec3, addVec3, MASK_SHOT, CONTENTS_SLIME, CONTENTS_LAVA, CONTENTS_WATER, CONTENTS_PLAYER, MASK_PROJECTILE, CONTENTS_DEADMONSTER } from '@quake2ts/shared';
import { T_RadiusDamage } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { DamageMod } from '../../combat/damageMods.js';
import { MulticastType } from '../../imports.js';
import { visible } from '../../ai/perception.js';

// Constants
const PROX_TIME_TO_LIVE = 45;
const PROX_TIME_DELAY = 0.5;
const PROX_BOUND_SIZE = 96;
const PROX_DAMAGE_RADIUS = 192;
const PROX_HEALTH = 20;
const PROX_DAMAGE = 90;
const PROX_STOP_EPSILON = 0.1;
const MAX_PROX_MINES = 50;

// Helper to check team damage (simplified for now, assumes deathmatch mostly or simple teams)
function CheckTeamDamage(targ: Entity, attacker: Entity): boolean {
    if (targ === attacker) return true;
    if (targ && attacker && targ.index && attacker.index && targ.index === attacker.index) return true;
    // TODO: Implement proper team damage check
    return false;
}

function SetNextThink(ent: Entity, time: number, context: EntitySystem) {
    ent.nextthink = time;
    context.scheduleThink(ent, time);
}

function PlayerNoise(who: Entity, where: Vec3, type: number) {
    // TODO: Implement PlayerNoise
}

function G_Spawn(entities: EntitySystem): Entity {
    return entities.spawn();
}

function G_FreeEdict(entities: EntitySystem, ent: Entity) {
    entities.free(ent);
}

// Helper to manually check if entity is freed since free() might be deferred
function isFreed(ent: Entity): boolean {
    return !ent.inUse || (ent as any).freePending;
}

function Prox_Explode(ent: Entity, entities: EntitySystem) {
    let owner = ent;
    if (ent.teammaster) {
        owner = ent.teammaster;
        // PlayerNoise(owner, ent.origin, PNOISE_IMPACT);
    }

    if (ent.dmg > PROX_DAMAGE) {
        entities.sound(ent, 2, "items/damage3.wav", 1, 1, 0);
    }

    ent.takedamage = false;
    T_RadiusDamage(
        Array.from(entities.findByRadius(ent.origin, PROX_DAMAGE_RADIUS)) as unknown as any,
        ent as any,
        owner as any,
        ent.dmg,
        ent as any,
        PROX_DAMAGE_RADIUS,
        DamageFlags.NONE,
        DamageMod.PROX,
        entities.timeSeconds,
        {},
        entities.multicast.bind(entities)
    );

    const origin = addVec3(ent.origin, scaleVec3(ent.velocity, -0.02));
    if (ent.groundentity) {
        entities.multicast(origin, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.GRENADE_EXPLOSION, origin);
    } else {
        entities.multicast(origin, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.ROCKET_EXPLOSION, origin);
    }

    // Free the trigger field
    if (ent.teamchain && ent.teamchain.owner === ent) {
        G_FreeEdict(entities, ent.teamchain);
    }

    G_FreeEdict(entities, ent);
}

function prox_die(self: Entity, inflictor: Entity, attacker: Entity, damage: number, point: Vec3, context: EntitySystem) {
    // If set off by another prox, delay a little
    if (inflictor.classname === 'prox_mine') {
        self.takedamage = false;
        Prox_Explode(self, context);
    } else {
        self.takedamage = false;
        self.think = (ent) => Prox_Explode(ent, context);
        SetNextThink(self, context.timeSeconds + 0.1, context);
    }
}

function Prox_Field_Touch(ent: Entity, other: Entity | null, plane: any, surf: any, context: EntitySystem) {
    if (!ent.owner) return; // Should not happen if linked correctly
    const prox = ent.owner;

    if (!other) return;

    if (!(other.svflags & 0x00000001) && !other.client) { // SVF_MONSTER check approximation?
         // In this engine, svflags might not be directly exposed same way.
         // We check if it's a monster or client.
         const isMonster = !!other.monsterinfo;
         if (!isMonster && !other.client) return;
    }

    if (prox.teammaster && CheckTeamDamage(other, prox.teammaster)) return;

    if (!context.deathmatch && other.client) return;

    if (other === prox) return;

    // Check if prox is already exploding
    // In JS we can check function reference if we preserved it, or use a flag.
    // For now, check health? or takedamage?
    if (!prox.takedamage) return;

    if (prox.teamchain === ent) {
        context.sound(ent, 2, "weapons/proxwarn.wav", 1, 1, 0);
        prox.think = (e) => Prox_Explode(e, context);
        SetNextThink(prox, context.timeSeconds + PROX_TIME_DELAY, context);
        return;
    }

    ent.solid = Solid.Not;
    G_FreeEdict(context, ent);
}

function prox_seek(ent: Entity, context: EntitySystem) {
    if (context.timeSeconds > ent.wait) {
        Prox_Explode(ent, context);
    } else {
        ent.frame++;
        if (ent.frame > 13) ent.frame = 9;
        ent.think = (e) => prox_seek(e, context);
        SetNextThink(ent, context.timeSeconds + 0.1, context);
    }
}

function prox_open(ent: Entity, context: EntitySystem) {
    if (ent.frame === 9) {
        // End of opening animation
        ent.s_sound = 0; // Clear sound? TS entity doesn't have s_sound direct access usually, maybe logic handles it.

        if (context.deathmatch) {
            ent.owner = null;
        }

        if (ent.teamchain) {
            ent.teamchain.touch = (self, other, plane, surf) => Prox_Field_Touch(self, other, plane, surf, context);
        }

        // Search for targets
        const targets = context.findByRadius(ent.origin, PROX_DAMAGE_RADIUS + 10);
        for (const search of targets) {
            if (!search.classname) continue;
            if (!ent.teammaster) continue;
            if (CheckTeamDamage(search, ent.teammaster)) continue;

            // Monster or player with health > 0
            const isMonster = !!search.monsterinfo; // SVF_MONSTER
            const isProx = search.classname === 'prox_mine';
            const isPlayerStart = search.classname.startsWith('info_player_');
            const isTeleportDest = search.classname === 'misc_teleporter_dest';
            const isFlag = search.classname.startsWith('item_flag_');

            if (search !== ent &&
                (
                    ((isMonster || (context.deathmatch && (search.client || isProx))) && search.health > 0) ||
                    (context.deathmatch && (isPlayerStart || isTeleportDest || isFlag))
                ) &&
                visible(ent, search, context as any)
            ) {
                context.sound(ent, 2, "weapons/proxwarn.wav", 1, 1, 0);
                Prox_Explode(ent, context);
                return;
            }
        }

        // Set lifetime
        // Simply use defaults for now as we don't have g_dm_strong_mines cvar easily accessible maybe
        ent.wait = context.timeSeconds + PROX_TIME_TO_LIVE;

        ent.think = (e) => prox_seek(e, context);
        SetNextThink(ent, context.timeSeconds + 0.2, context);

    } else {
        if (ent.frame === 0) {
            context.sound(ent, 2, "weapons/proxopen.wav", 1, 1, 0);
        }
        ent.frame++;
        ent.think = (e) => prox_open(e, context);
        SetNextThink(ent, context.timeSeconds + 0.1, context);
    }
}

function prox_land(ent: Entity, other: Entity | null, plane: any, surf: any, context: EntitySystem) {
    if (surf && (surf.flags & 4)) { // SURF_SKY
        G_FreeEdict(context, ent);
        return;
    }

    if (plane && plane.normal) {
        const land_point = addVec3(ent.origin, scaleVec3(plane.normal, -10.0));
        const contents = context.pointcontents(land_point);
        if (contents & (CONTENTS_SLIME | CONTENTS_LAVA)) {
            Prox_Explode(ent, context);
            return;
        }
    }

    if (!plane || !plane.normal || (other && (other.monsterinfo || other.client || other.takedamage))) { // Approximation of damageable/alive
        if (!ent.teammaster || other !== ent.teammaster) {
            Prox_Explode(ent, context);
        }
        return;
    } else if (other && other !== context.world) {
        // Sticky logic
        let stick_ok = false;
        if ((other.movetype === MoveType.Push || other === context.world || other.modelindex === 1) && plane.normal.z > 0.7) {
            stick_ok = true;
        }

        // Clip velocity
        const backoff = dotVec3(ent.velocity, plane.normal) * 1.5;
        const change = scaleVec3(plane.normal, backoff);
        const out = {
            x: ent.velocity.x - change.x,
            y: ent.velocity.y - change.y,
            z: ent.velocity.z - change.z
        };

        if (Math.abs(out.x) < PROX_STOP_EPSILON) out.x = 0;
        if (Math.abs(out.y) < PROX_STOP_EPSILON) out.y = 0;
        if (Math.abs(out.z) < PROX_STOP_EPSILON) out.z = 0;

        if (out.z > 60) return;

        if (stick_ok) {
             ent.velocity = ZERO_VEC3;
             ent.avelocity = ZERO_VEC3;
        } else {
             // If we didn't stick but hit floor, maybe we should stop?
             // Original logic exploded on floor if not sticky.
             // But for now let's assume if it's not sticky surface it bounces or slides?
             // But we just returned if not > 0.7.
             // If > 0.7 (floor) and not stick_ok (e.g. weird entity), explode?
             // Let's keep explosion for non-sticky floors (e.g. entities we can't stick to)
             if (plane.normal.z > 0.7) {
                Prox_Explode(ent, context);
                return;
            }
            return;
        }
    } else if (other && other.modelindex !== 1) { // MODELINDEX_WORLD
         return;
    }

    // Landed

    // Spawn field
    const field = G_Spawn(context);
    field.origin = copyVec3(ent.origin);
    field.mins = { x: -PROX_BOUND_SIZE, y: -PROX_BOUND_SIZE, z: -PROX_BOUND_SIZE };
    field.maxs = { x: PROX_BOUND_SIZE, y: PROX_BOUND_SIZE, z: PROX_BOUND_SIZE };
    field.movetype = MoveType.None;
    field.solid = Solid.Trigger;
    field.owner = ent;
    field.classname = "prox_field";
    field.teammaster = ent;
    context.linkentity(field);

    ent.velocity = ZERO_VEC3;
    ent.avelocity = ZERO_VEC3;
    ent.takedamage = true;
    ent.movetype = MoveType.None;

    ent.die = (self, inflictor, attacker, damage, point) => prox_die(self, inflictor as Entity, attacker as Entity, damage, point, context);
    ent.teamchain = field;
    ent.health = PROX_HEALTH;

    ent.think = (e) => prox_open(e, context);
    // Ensure nextthink is positive and future
    SetNextThink(ent, context.timeSeconds + 0.1, context);

    ent.touch = undefined; // No longer explode on touch?
    ent.solid = Solid.BoundingBox;

    context.linkentity(ent);
}

function Prox_Think(ent: Entity, context: EntitySystem) {
    if (ent.timestamp <= context.timeSeconds) {
        Prox_Explode(ent, context);
        return;
    }
    // Update angles based on velocity?
    SetNextThink(ent, context.timeSeconds, context); // Or +0.1?
    // Prox_Think just waits.
    // If we want it to run every frame, we schedule it.
    // But original code might not run it?
    // "Update angles based on velocity?"
    // If we don't schedule it, it stops thinking.
    // But we need to check timestamp.
    // So yes, schedule it.
    SetNextThink(ent, context.timeSeconds + 0.1, context);
}

export function createProxMine(
    entities: EntitySystem,
    owner: Entity,
    start: Vec3,
    dir: Vec3,
    speed: number = 600
): Entity {
    // Limit check: Enforce MAX_PROX_MINES per player
    const existingMines = entities.findByClassname('prox_mine').filter(e => e.inUse && e.owner === owner);
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
    mine.teammaster = owner;

    mine.origin = copyVec3(start);
    mine.velocity = scaleVec3(dir, speed);

    mine.movetype = MoveType.Bounce;
    mine.solid = Solid.BoundingBox;
    mine.clipmask = MASK_PROJECTILE | CONTENTS_LAVA | CONTENTS_SLIME;

    // Paril-KEX logic for player collision
    if (owner.client) {
         mine.clipmask &= ~CONTENTS_PLAYER;
    }

    mine.mins = { x: -6, y: -6, z: -6 };
    mine.maxs = { x: 6, y: 6, z: 6 };
    mine.modelindex = entities.modelIndex("models/weapons/g_prox/tris.md2");

    mine.touch = (self, other, plane, surf) => prox_land(self, other, plane, surf, entities);
    mine.think = (e) => Prox_Think(e, entities);
    // mine.nextthink = entities.timeSeconds;
    SetNextThink(mine, entities.timeSeconds + 0.1, entities);

    mine.dmg = PROX_DAMAGE; // Multiplier?
    mine.takedamage = true;
    mine.health = PROX_HEALTH;
    mine.die = (self, inflictor, attacker, damage, point) => prox_die(self, inflictor as Entity, (attacker || null) as Entity, damage, point, entities);

    mine.timestamp = entities.timeSeconds + PROX_TIME_TO_LIVE;

    entities.linkentity(mine);

    return mine;
}
