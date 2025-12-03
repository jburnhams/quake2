// =================================================================
// Quake II - Gibs
// =================================================================

import { Entity, MoveType, Solid, EntityFlags } from './entity.js';
import { EntitySystem } from './system.js';
import { createRandomGenerator, Vec3, scaleVec3, addVec3 } from '@quake2ts/shared';

const random = createRandomGenerator();

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

export function spawnGib(sys: EntitySystem, origin: Vec3, damage: number, model?: string, type?: number) {
    const gib = sys.spawn();
    gib.classname = 'gib';
    gib.origin = {
        x: origin.x + (random.frandom() - 0.5) * 20,
        y: origin.y + (random.frandom() - 0.5) * 20,
        z: origin.z + (random.frandom() - 0.5) * 20
    };

    gib.velocity = {
        x: (random.frandom() - 0.5) * 300,
        y: (random.frandom() - 0.5) * 300,
        z: 200 + random.frandom() * 100
    };

    gib.movetype = MoveType.Bounce;
    gib.solid = Solid.Not;

    // Gibs should clip against world but not other entities
    gib.clipmask = 0x00000001; // MASK_SOLID
    gib.avelocity = {
        x: random.crandom() * 600,
        y: random.crandom() * 600,
        z: random.crandom() * 600
    };

    // Default models if none provided
    const defaultModels = [
        'models/objects/gibs/bone/tris.md2',
        'models/objects/gibs/meat/tris.md2',
        'models/objects/gibs/sm_meat/tris.md2',
    ];

    const modelName = model || defaultModels[Math.floor(random.frandom() * defaultModels.length)];
    gib.modelindex = sys.modelIndex(modelName);

    // Mins/Maxs for gibs
    gib.mins = { x: -2, y: -2, z: -2 };
    gib.maxs = { x: 2, y: 2, z: 2 };

    if (type && (type & GIB_METALLIC)) {
         // Metallic gibs might have different sounds or effects in a full port
    }

    gib.think = (self: Entity) => {
        sys.free(self);
    };
    sys.scheduleThink(gib, sys.timeSeconds + 10 + random.frandom() * 10); // Fade out/remove

    sys.finalizeSpawn(gib);
    return gib;
}

// Support both signatures:
// 1. throwGibs(sys, origin, damage) - Existing
// 2. throwGibs(sys, origin, defs) - New for func_explosive

export function throwGibs(sys: EntitySystem, origin: Vec3, damageOrDefs: number | GibDef[], model?: string, type?: GibType) {
    if (typeof damageOrDefs === 'number') {
        const damage = damageOrDefs;
        const count = 4 + Math.floor(random.frandom() * 4);
        for (let i = 0; i < count; i++) {
            spawnGib(sys, origin, damage, model, type);
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
