// =================================================================
// Quake II - Gibs
// =================================================================

import { Entity, MoveType, Solid } from './entity.js';
import { EntitySystem } from './system.js';
import { createRandomGenerator, Vec3 } from '@quake2ts/shared';

const random = createRandomGenerator();

export function spawnGib(sys: EntitySystem, origin: Vec3, damage: number) {
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

    // Random gib model
    // models/objects/gibs/bone/tris.md2
    // models/objects/gibs/meat/tris.md2
    // models/objects/gibs/sm_meat/tris.md2
    // models/objects/gibs/arm/tris.md2 (optional, larger part)
    const models = [
        'models/objects/gibs/bone/tris.md2',
        'models/objects/gibs/meat/tris.md2',
        'models/objects/gibs/sm_meat/tris.md2',
    ];
    // Add extra gibs if available
    const modelName = models[Math.floor(random.frandom() * models.length)];
    gib.modelindex = sys.modelIndex(modelName);

    // Mins/Maxs for gibs
    gib.mins = { x: -2, y: -2, z: -2 };
    gib.maxs = { x: 2, y: 2, z: 2 };

    gib.think = (self: Entity) => {
        sys.free(self);
    };
    sys.scheduleThink(gib, sys.timeSeconds + 10 + random.frandom() * 10); // Fade out/remove

    sys.finalizeSpawn(gib);
}

export function throwGibs(sys: EntitySystem, origin: Vec3, damage: number) {
    // Number of gibs depends on damage? or just random
    const count = 4 + Math.floor(random.frandom() * 4);
    for (let i = 0; i < count; i++) {
        spawnGib(sys, origin, damage);
    }
    // TODO: Spawn blood effect via TE_BLOOD shower if desired?
    // G_ThrowGibs in original just spawns models.
}
