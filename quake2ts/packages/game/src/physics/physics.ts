import { Entity, MoveType } from '../entities/entity.js';
import { TraceResult, Vec3, CONTENTS_LAVA, CONTENTS_SLIME, CONTENTS_WATER } from '@quake2ts/shared';
import { GameEngine } from '../index.js';
import { EntitySystem } from '../entities/system.js';

const SV_GRAVITY = 800;
const SV_MAXVELOCITY = 2000;

export function checkVelocity(entity: Entity) {
    const speed = Math.sqrt(
        entity.velocity.x * entity.velocity.x +
        entity.velocity.y * entity.velocity.y +
        entity.velocity.z * entity.velocity.z
    );

    if (speed > SV_MAXVELOCITY) {
        const scale = SV_MAXVELOCITY / speed;
        entity.velocity.x *= scale;
        entity.velocity.y *= scale;
        entity.velocity.z *= scale;
    }
}

export function applyGravity(entity: Entity, deltaTime: number) {
    if (entity.gravity === 0) {
        return;
    }

    entity.velocity.z -= entity.gravity * SV_GRAVITY * deltaTime;
}

const STOP_EPSILON = 0.1;

export function clipVelocity(vel: Vec3, normal: Vec3, overbounce: number): Vec3 {
    const backoff = (vel.x * normal.x + vel.y * normal.y + vel.z * normal.z) * overbounce;

    const newVel = { ...vel };

    newVel.x -= normal.x * backoff;
    newVel.y -= normal.y * backoff;
    newVel.z -= normal.z * backoff;

    if (
        Math.abs(newVel.x) < STOP_EPSILON &&
        Math.abs(newVel.y) < STOP_EPSILON &&
        Math.abs(newVel.z) < STOP_EPSILON
    ) {
        return { x: 0, y: 0, z: 0 };
    }

    return newVel;
}

export function checkWaterTransition(gameEngine: GameEngine, entity: Entity): boolean {
    const wasinwater = (entity.watertype & (CONTENTS_LAVA | CONTENTS_SLIME | CONTENTS_WATER)) !== 0;
    checkWater(gameEngine, entity);
    const isinwater = (entity.watertype & (CONTENTS_LAVA | CONTENTS_SLIME | CONTENTS_WATER)) !== 0;

    if (isinwater !== wasinwater) {
        // TODO: play water sound
    }

    return isinwater;
}

export function physicsToss(
    gameEngine: GameEngine,
    entitySystem: EntitySystem,
    entity: Entity,
    deltaTime: number
) {
    if (entity.groundentity) {
        return;
    }

    checkVelocity(entity);
    applyGravity(entity, deltaTime);

    const end = {
        x: entity.origin.x + entity.velocity.x * deltaTime,
        y: entity.origin.y + entity.velocity.y * deltaTime,
        z: entity.origin.z + entity.velocity.z * deltaTime,
    };

    const trace = gameEngine.trace(
        entity.origin,
        end,
        entity.mins,
        entity.maxs,
        entity,
        0
    );

    if (trace.fraction < 1.0) {
        if (entity.movetype === MoveType.Bounce) {
            if (trace.plane) {
                entity.velocity = clipVelocity(entity.velocity, trace.plane.normal, 1.5);
            }
        } else {
            explode(entitySystem, entity);
        }
    } else {
        entity.origin = trace.endpos;
    }

    checkWaterTransition(gameEngine, entity);
}

export function explode(entitySystem: EntitySystem, entity: Entity) {
    entitySystem.free(entity);
}

export function fixStuck(gameEngine: GameEngine, entity: Entity) {
    const NUDGE = 1.0;
    const directions = [
        { x: NUDGE, y: 0, z: 0 },
        { x: -NUDGE, y: 0, z: 0 },
        { x: 0, y: NUDGE, z: 0 },
        { x: 0, y: -NUDGE, z: 0 },
        { x: 0, y: 0, z: NUDGE },
        { x: 0, y: 0, z: -NUDGE },
    ];

    for (const dir of directions) {
        const end = {
            x: entity.origin.x + dir.x,
            y: entity.origin.y + dir.y,
            z: entity.origin.z + dir.z,
        };

        const trace = gameEngine.trace(
            entity.origin,
            end,
            entity.mins,
            entity.maxs,
            entity,
            0
        );

        if (trace.fraction === 1.0 && !trace.startsolid) {
            entity.origin = end;
            return;
        }
    }
}

export function checkWater(gameEngine: GameEngine, entity: Entity) {
    const p1 = { ...entity.origin };
    const p2 = { ...entity.origin };
    p2.z += entity.mins.z + 1;
    const p3 = { ...entity.origin };
    p3.z += entity.maxs.z - 1;

    const c1 = gameEngine.pointcontents(p1);
    const c2 = gameEngine.pointcontents(p2);
    const c3 = gameEngine.pointcontents(p3);
    const contents = c1 | c2 | c3;

    if (contents & (CONTENTS_LAVA | CONTENTS_SLIME | CONTENTS_WATER)) {
        entity.watertype = contents;
        entity.waterlevel = 1;

        if (c1 & (CONTENTS_LAVA | CONTENTS_SLIME | CONTENTS_WATER)) {
            entity.waterlevel = 2;
        }

        if (c3 & (CONTENTS_LAVA | CONTENTS_SLIME | CONTENTS_WATER)) {
            entity.waterlevel = 3;
        }
    } else {
        entity.watertype = 0;
        entity.waterlevel = 0;
    }
}
