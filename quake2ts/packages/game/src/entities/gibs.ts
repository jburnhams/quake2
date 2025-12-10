// =================================================================
// Quake II - Gibs
// =================================================================

import { Entity, MoveType, Solid, CollisionSurface } from './entity.js';
import { EntitySystem } from './system.js';
import { createRandomGenerator, Vec3, scaleVec3, TempEntity, ServerCommand, CollisionPlane } from '@quake2ts/shared';
import { DamageMod } from '../combat/damageMods.js';
import { EntityEffects } from './enums.js';
import { MulticastType } from '../imports.js';

export const GIB_ORGANIC = 0;
export const GIB_METALLIC = 1;
export const GIB_DEBRIS = 2;

export enum GibType {
    Metallic = 1,
    Debris = 2
}

export interface GibDef {
    count: number;
    model: string;
    flags?: number; // GIB_METALLIC | GIB_DEBRIS
}

function velocityForDamage(damage: number, rng: { crandom: () => number, frandom: () => number }): Vec3 {
    let x = 100.0 * rng.crandom();
    let y = 100.0 * rng.crandom();
    let z = 200.0 + 100.0 * rng.frandom();

    if (damage < 50) {
        x *= 0.7;
        y *= 0.7;
        z *= 0.7;
    } else {
        x *= 1.2;
        y *= 1.2;
        z *= 1.2;
    }
    return { x, y, z };
}

function clipGibVelocity(ent: Entity) {
    let { x, y, z } = ent.velocity;

    if (x < -300) x = -300;
    else if (x > 300) x = 300;

    if (y < -300) y = -300;
    else if (y > 300) y = 300;

    if (z < 200) z = 200; // always some upwards
    else if (z > 500) z = 500;

    ent.velocity = { x, y, z };
}

function gib_touch(self: Entity, other: Entity | null, plane: CollisionPlane | null | undefined, surf: CollisionSurface | null | undefined, sys: EntitySystem) {
    if (!self.groundentity) return;

    self.touch = undefined; // NULL in C

    if (plane) {
        sys.sound(self, 0, 'misc/fhit3.wav', 1, 1, 0); // CHAN_VOICE, ATTN_NORM
    }
}

export function spawnGib(sys: EntitySystem, origin: Vec3, damage: number, model?: string, type: number = GIB_ORGANIC, mod: DamageMod = DamageMod.UNKNOWN) {
    const gib = sys.spawn();
    gib.classname = 'gib';

    // Use sys.rng
    gib.origin = {
        x: origin.x + sys.rng.crandom() * 20,
        y: origin.y + sys.rng.crandom() * 20,
        z: origin.z + sys.rng.crandom() * 20
    };

    const modelName = model || 'models/objects/gibs/sm_meat/tris.md2';
    gib.modelindex = sys.modelIndex(modelName);

    gib.mins = { x: -2, y: -2, z: -2 };
    gib.maxs = { x: 2, y: 2, z: 2 };

    gib.solid = Solid.Not;
    gib.takedamage = true;
    gib.die = (self, inflictor, attacker, dmg, point, mod) => {
        sys.free(self);
    };

    gib.clipmask = 0x00000001; // MASK_SOLID

    let vscale = 1.0;

    if (type === GIB_ORGANIC) {
        gib.movetype = MoveType.Toss;
        gib.touch = (self, other, plane, surf) => gib_touch(self, other, plane, surf, sys);
        vscale = 0.5;
    } else {
        gib.movetype = MoveType.Bounce;
        vscale = 1.0;
    }

    // Apply effects based on damage mod
    if (mod === DamageMod.LAVA || mod === DamageMod.TRAP) {
        // Burn gibs: No blood
        gib.effects |= EntityEffects.Rocket; // Smoke trail effect
    } else if (type !== GIB_METALLIC && type !== GIB_DEBRIS) {
        // Organic gibs bleed unless burned
        gib.effects |= EntityEffects.Gib;
    }

    const vd = velocityForDamage(damage, sys.rng);

    gib.velocity = {
        x: vd.x * vscale,
        y: vd.y * vscale,
        z: vd.z * vscale
    };

    clipGibVelocity(gib);

    gib.avelocity = {
        x: sys.rng.frandom() * 600,
        y: sys.rng.frandom() * 600,
        z: sys.rng.frandom() * 600
    };

    if (type === GIB_ORGANIC && mod !== DamageMod.LAVA && mod !== DamageMod.TRAP) {
        // Correct usage of TempEntity.BLOOD (1)
        // Original Source: g_phys.c -> ThrowGib
        sys.multicast(
            gib.origin,
            MulticastType.Pvs,
            ServerCommand.temp_entity,
            TempEntity.BLOOD, // ID
            gib.origin.x, gib.origin.y, gib.origin.z, // Pos
            gib.velocity.x, gib.velocity.y, gib.velocity.z // Dir
        );
    }

    gib.think = (self: Entity) => {
        sys.free(self);
    };
    sys.scheduleThink(gib, sys.timeSeconds + 10 + sys.rng.frandom() * 10);

    sys.finalizeSpawn(gib);
    return gib;
}

// Matches ThrowClientHead logic in g_misc.c (mostly)
// Replaces ThrowHead behavior for generic monsters too for now.
export function spawnHead(sys: EntitySystem, origin: Vec3, damage: number, mod: DamageMod = DamageMod.UNKNOWN) {
    const head = sys.spawn();

    // Randomize between skull (skin 0) and player head (skin 1)
    let gibname: string;
    if (sys.rng.irandom(2) === 1) {
        gibname = "models/objects/gibs/head2/tris.md2";
        head.skin = 1; // second skin is player
    } else {
        gibname = "models/objects/gibs/skull/tris.md2";
        head.skin = 0;
    }

    head.frame = 0;
    head.modelindex = sys.modelIndex(gibname);

    head.mins = { x: -16, y: -16, z: 0 };
    head.maxs = { x: 16, y: 16, z: 16 };

    head.origin = {
        x: origin.x,
        y: origin.y,
        z: origin.z + 32
    };

    head.solid = Solid.Not;
    head.takedamage = true;
    head.die = (self, inflictor, attacker, dmg, point, mod) => {
        sys.free(self);
    };

    // Generic head is organic
    let vscale = 0.5;

    head.movetype = MoveType.Toss;
    head.touch = (self, other, plane, surf) => gib_touch(self, other, plane, surf, sys);

    if (mod === DamageMod.LAVA || mod === DamageMod.TRAP) {
        // Burn gibs: No blood
        head.effects |= EntityEffects.Rocket; // Smoke trail effect
    } else {
        head.effects |= EntityEffects.Gib;
    }

    const vd = velocityForDamage(damage, sys.rng);

    head.velocity = {
        x: vd.x * vscale,
        y: vd.y * vscale,
        z: vd.z * vscale
    };

    clipGibVelocity(head);

    head.avelocity = { x: 0, y: sys.rng.crandom() * 600, z: 0 };

    if (mod !== DamageMod.LAVA && mod !== DamageMod.TRAP) {
        // Blood shower for head too
        sys.multicast(
            head.origin,
            MulticastType.Pvs,
            ServerCommand.temp_entity,
            TempEntity.BLOOD, // ID
            head.origin.x, head.origin.y, head.origin.z, // Pos
            head.velocity.x, head.velocity.y, head.velocity.z // Dir
        );
    }

    head.think = (self: Entity) => {
        sys.free(self);
    };
    sys.scheduleThink(head, sys.timeSeconds + 10 + sys.rng.frandom() * 10);

    sys.finalizeSpawn(head);
    return head;
}

export function throwGibs(sys: EntitySystem, origin: Vec3, damageOrDefs: number | GibDef[], type: number = GIB_ORGANIC, mod: DamageMod = DamageMod.UNKNOWN) {
    if (typeof damageOrDefs === 'number') {
        const damage = damageOrDefs;

        if (type === GIB_METALLIC) {
             spawnGib(sys, origin, damage, 'models/objects/debris1/tris.md2', type, mod);
             spawnGib(sys, origin, damage, 'models/objects/debris2/tris.md2', type, mod);
             spawnGib(sys, origin, damage, 'models/objects/debris3/tris.md2', type, mod);
             spawnGib(sys, origin, damage, 'models/objects/debris2/tris.md2', type, mod);
        } else {
            spawnGib(sys, origin, damage, 'models/objects/gibs/sm_meat/tris.md2', type, mod);
            spawnGib(sys, origin, damage, 'models/objects/gibs/sm_meat/tris.md2', type, mod);
            spawnGib(sys, origin, damage, 'models/objects/gibs/sm_meat/tris.md2', type, mod);
            spawnGib(sys, origin, damage, 'models/objects/gibs/sm_meat/tris.md2', type, mod);

            spawnGib(sys, origin, damage, 'models/objects/gibs/meat/tris.md2', type, mod);
            spawnGib(sys, origin, damage, 'models/objects/gibs/bone/tris.md2', type, mod);

            // Spawn head
            spawnHead(sys, origin, damage, mod);
        }

    } else {
        const defs = damageOrDefs;
        for (const def of defs) {
            for (let i = 0; i < def.count; i++) {
                spawnGib(sys, origin, 0, def.model, def.flags, mod);
            }
        }
    }
}
