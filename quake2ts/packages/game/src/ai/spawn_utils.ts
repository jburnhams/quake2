import { Entity } from '../entities/entity.js';
import { EntitySystem } from '../entities/system.js';
import { Vec3, MASK_MONSTERSOLID } from '@quake2ts/shared';

// Checks if a box is valid at origin (not stuck)
export function checkSpawnPoint(origin: Vec3, mins: Vec3, maxs: Vec3, context: EntitySystem): boolean {
    if (!mins || !maxs) return false;

    const trace = context.trace(origin, mins, maxs, origin, null, MASK_MONSTERSOLID);
    if (trace.startsolid || trace.allsolid) {
        return false;
    }

    return true;
}

// Finds a valid spawn point near startpoint
// Rogue logic involves drop to floor and stuck fixing.
// We'll implement a simplified version: check start, if valid, drop to floor.
export function findSpawnPoint(startpoint: Vec3, mins: Vec3, maxs: Vec3, context: EntitySystem): Vec3 | null {
    // Try to drop to floor
    const down = { ...startpoint, z: startpoint.z - 256 };
    const trace = context.trace(startpoint, mins, maxs, down, null, MASK_MONSTERSOLID);

    if (trace.startsolid || trace.allsolid) {
        // We are stuck at start.
        // Try slightly higher?
        const up = { ...startpoint, z: startpoint.z + 16 };
        if (checkSpawnPoint(up, mins, maxs, context)) {
            // Drop from here
            const trace2 = context.trace(up, mins, maxs, { ...up, z: up.z - 256 }, null, MASK_MONSTERSOLID);
            if (!trace2.startsolid && !trace2.allsolid && trace2.fraction < 1.0) {
                return trace2.endpos;
            }
        }
        return null;
    }

    if (trace.fraction === 1.0) {
        // Floating in air?
        return trace.endpos;
    }

    return trace.endpos;
}

export function checkGroundSpawnPoint(origin: Vec3, mins: Vec3, maxs: Vec3, height: number, gravity: number, context: EntitySystem): boolean {
    if (!checkSpawnPoint(origin, mins, maxs, context)) {
        return false;
    }

    // Simple ground check
    const trace = context.trace(origin, mins, maxs, { ...origin, z: origin.z - 10 }, null, MASK_MONSTERSOLID);
    if (trace.fraction === 1.0) {
        return false; // No ground
    }

    return true;
}
