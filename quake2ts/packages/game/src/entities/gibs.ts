// =================================================================
// Quake II - Gibs
// =================================================================

import { Entity, MoveType, Solid } from './entity.js';
import { EntitySystem } from './system.js';
import { createRandomGenerator, Vec3, scaleVec3 } from '@quake2ts/shared';
import { DamageMod } from '../combat/damageMods.js';

const random = createRandomGenerator();

export const GIB_ORGANIC = 0;
export const GIB_METALLIC = 1;
export const GIB_DEBRIS = 2;

export interface GibDef {
    count: number;
    model: string;
    flags?: number; // GIB_METALLIC | GIB_DEBRIS
}

function velocityForDamage(damage: number): Vec3 {
    let x = 100.0 * random.crandom();
    let y = 100.0 * random.crandom();
    let z = 200.0 + 100.0 * random.frandom();

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

function gib_touch(self: Entity, other: Entity | null, plane: any, surf: any, sys: EntitySystem) {
    if (!self.groundentity) return;

    self.touch = undefined; // NULL in C

    if (plane) {
        sys.sound(self, 0, 'misc/fhit3.wav', 1, 1, 0); // CHAN_VOICE, ATTN_NORM

        // Align logic ignored for now as it requires matrix math or setting angles directly.
    }
}

export function spawnGib(sys: EntitySystem, origin: Vec3, damage: number, model?: string, type: number = GIB_ORGANIC) {
    const gib = sys.spawn();
    gib.classname = 'gib';

    gib.origin = {
        x: origin.x + random.crandom() * 20,
        y: origin.y + random.crandom() * 20,
        z: origin.z + random.crandom() * 20
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

    const vd = velocityForDamage(damage);

    gib.velocity = {
        x: vd.x * vscale,
        y: vd.y * vscale,
        z: vd.z * vscale
    };

    clipGibVelocity(gib);

    gib.avelocity = {
        x: random.frandom() * 600,
        y: random.frandom() * 600,
        z: random.frandom() * 600
    };

    gib.think = (self: Entity) => {
        sys.free(self);
    };
    sys.scheduleThink(gib, sys.timeSeconds + 10 + random.frandom() * 10);

    sys.finalizeSpawn(gib);
    return gib;
}

// Matches ThrowClientHead logic in g_misc.c (mostly)
// Replaces ThrowHead behavior for generic monsters too for now.
export function spawnHead(sys: EntitySystem, origin: Vec3, damage: number) {
    const head = sys.spawn();

    // Randomize between skull (skin 0) and player head (skin 1)
    // irandom(maxExclusive) -> irandom(2) returns 0 or 1.
    let gibname: string;
    if (random.irandom(2) === 1) {
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
    // const type = GIB_ORGANIC;
    let vscale = 0.5;

    head.movetype = MoveType.Toss;
    head.touch = (self, other, plane, surf) => gib_touch(self, other, plane, surf, sys);

    const vd = velocityForDamage(damage);

    head.velocity = {
        x: vd.x * vscale,
        y: vd.y * vscale,
        z: vd.z * vscale
    };

    clipGibVelocity(head);

    head.avelocity = { x: 0, y: random.crandom() * 600, z: 0 };

    head.think = (self: Entity) => {
        sys.free(self);
    };
    sys.scheduleThink(head, sys.timeSeconds + 10 + random.frandom() * 10);

    sys.finalizeSpawn(head);
    return head;
}

export function throwGibs(sys: EntitySystem, origin: Vec3, damageOrDefs: number | GibDef[], type: number = GIB_ORGANIC) {
    if (typeof damageOrDefs === 'number') {
        const damage = damageOrDefs;

        if (type === GIB_METALLIC) {
             // Debris 1, 2, 3
             // Based on func_explosive but scaled down a bit maybe?
             // func_explosive_explode spawns multiple debris based on mass.
             // Here we are generic.
             spawnGib(sys, origin, damage, 'models/objects/debris1/tris.md2', type);
             spawnGib(sys, origin, damage, 'models/objects/debris2/tris.md2', type);
             spawnGib(sys, origin, damage, 'models/objects/debris3/tris.md2', type);
             spawnGib(sys, origin, damage, 'models/objects/debris2/tris.md2', type);
        } else {
            spawnGib(sys, origin, damage, 'models/objects/gibs/sm_meat/tris.md2', type);
            spawnGib(sys, origin, damage, 'models/objects/gibs/sm_meat/tris.md2', type);
            spawnGib(sys, origin, damage, 'models/objects/gibs/sm_meat/tris.md2', type);
            spawnGib(sys, origin, damage, 'models/objects/gibs/sm_meat/tris.md2', type);

            spawnGib(sys, origin, damage, 'models/objects/gibs/meat/tris.md2', type);
            spawnGib(sys, origin, damage, 'models/objects/gibs/bone/tris.md2', type);

            // Spawn head
            spawnHead(sys, origin, damage);
        }

    } else {
        const defs = damageOrDefs;
        for (const def of defs) {
            for (let i = 0; i < def.count; i++) {
                spawnGib(sys, origin, 0, def.model, def.flags);
            }
        }
    }
}
