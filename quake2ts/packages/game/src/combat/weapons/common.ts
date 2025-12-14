import { Entity } from '../../entities/entity.js';
import { Vec3 } from '@quake2ts/shared';
import { PowerupId } from '../../inventory/playerInventory.js';

export function applyKick(player: Entity, pitch: number, yaw: number = 0, kickOrigin: number = 0) {
    if (player.client) {
        player.client.kick_angles = { x: pitch, y: yaw, z: 0 };
        player.client.kick_origin = { x: kickOrigin, y: 0, z: 0 };
    }
}

/**
 * Calculates the animation time frame for weapons.
 * Handles powerups like Haste (doubles speed) and Quad Fire.
 *
 * Source: p_weapon.cpp (implicit in logic)
 */
export function Weapon_AnimationTime(ent: Entity): number {
    // Default 10Hz (0.1s)
    // Haste doubles weapon speed (halves time)
    // Quad Fire (Xatrix) quadruples weapon speed

    let time = 0.1;

    if (ent.client?.inventory.powerups.has(PowerupId.TechHaste)) {
        time *= 0.5;
    }

    // Check for QuadFire (if implemented)
    if (ent.client?.inventory.powerups.has(PowerupId.QuadFire)) {
        time *= 0.25;
    }

    return time;
}
