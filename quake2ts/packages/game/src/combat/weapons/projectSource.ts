import { Entity } from '../../entities/entity.js';
import { GameExports } from '../../index.js';
import { angleVectors, addVec3, scaleVec3, Vec3 } from '@quake2ts/shared';

/**
 * Calculates the exact firing origin for a weapon projectile or hitscan.
 * Replicates the behavior of P_ProjectSource from the original Quake II source.
 *
 * Source: p_weapon.cpp:91-135
 *
 * @param game The game exports interface
 * @param player The player entity firing the weapon
 * @param fireOffset The forward/right/up offset from the player's eye position (e.g., {8, 8, 8})
 * @param forward The forward vector of the player's view
 * @param right The right vector of the player's view
 * @param up The up vector of the player's view
 * @returns The calculated world position to spawn the projectile or start the trace
 */
export function P_ProjectSource(
    game: GameExports,
    player: Entity,
    fireOffset: Vec3,
    forward: Vec3,
    right: Vec3,
    up: Vec3
): Vec3 {
    // Calculate eye position (start point)
    const eyePos: Vec3 = {
        x: player.origin.x,
        y: player.origin.y,
        z: player.origin.z + player.viewheight
    };

    // Calculate theoretical weapon muzzle position
    // point = start + forward * offset.x + right * offset.y + up * offset.z
    const muzzlePos = addVec3(
        eyePos,
        addVec3(
            scaleVec3(forward, fireOffset.x),
            addVec3(
                scaleVec3(right, fireOffset.y),
                scaleVec3(up, fireOffset.z)
            )
        )
    );

    // Prevent shooting through walls by tracing from eye to muzzle
    // Source: p_weapon.cpp:126-135
    const trace = game.trace(
        eyePos,
        null, // mins
        null, // maxs
        muzzlePos,
        player,
        0 // CONTENTS_SOLID
    );

    if (trace.fraction < 1.0) {
        // If we hit something between eye and muzzle, pull back slightly
        // so we don't start inside the wall
        return addVec3(trace.endpos, scaleVec3(forward, -1));
    }

    return muzzlePos;
}

/**
 * Helper to get the correct firing origin for a specific weapon.
 * Applies the correct offsets based on weapon type and P_ProjectSource logic.
 *
 * @param game Game exports
 * @param player Player entity
 * @param offset Optional custom offset (defaults to standard {8, 8, player.viewheight-8})
 */
export function getProjectileOrigin(game: GameExports, player: Entity, offset: Vec3 = { x: 8, y: 8, z: 8 }): Vec3 {
    const { forward, right, up } = angleVectors(player.angles);
    return P_ProjectSource(game, player, offset, forward, right, up);
}
