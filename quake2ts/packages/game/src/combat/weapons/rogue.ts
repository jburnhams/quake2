// =================================================================
// Quake II - Rogue Mission Pack Weapons
// =================================================================

import { Entity } from '../../entities/entity.js';
import { GameExports } from '../../index.js';
import { getWeaponState, WeaponState } from './state.js';
import { PlayerInventory, WeaponId } from '../../inventory/playerInventory.js';
import { AmmoType } from '../../inventory/ammo.js';
import {
    ZERO_VEC3, angleVectors, addVec3, scaleVec3, ServerCommand, TempEntity, Vec3,
    MZ_BLASTER, MZ_MACHINEGUN, MZ_SHOTGUN, MZ_CHAINGUN1, MZ_CHAINGUN2, MZ_CHAINGUN3,
    MZ_RAILGUN, MZ_ROCKET, MZ_GRENADE, MZ_LOGIN, MZ_LOGOUT, MZ_SSHOTGUN, MZ_BFG, MZ_HYPERBLASTER,
    MZ_IONRIPPER, MZ_PHALANX, MZ_PHALANX2
} from '@quake2ts/shared';
import { T_Damage, T_RadiusDamage } from '../damage.js';
import { DamageFlags } from '../damageFlags.js';
import { DamageMod } from '../damageMods.js';
import { MulticastType } from '../../imports.js';
import { firingRandom } from './firing.js';
import { createIonRipper, createPhalanxBall, createFlechette } from '../../entities/projectiles.js';
import { P_ProjectSource } from './projectSource.js';

function applyKick(player: Entity, pitch: number, yaw: number = 0, kickOrigin: number = 0) {
    if (player.client) {
        player.client.kick_angles = { x: pitch, y: yaw, z: 0 };
        player.client.kick_origin = { x: kickOrigin, y: 0, z: 0 };
    }
}

// Rogue Heatbeam (Plasma Beam)
// Source: g_rogue_weapon.c / p_rogue_weapon.c
export function firePlasmaBeam(game: GameExports, player: Entity, inventory: PlayerInventory, weaponState: WeaponState, start: Vec3, forward: Vec3) {
    // Ammo check
    if (inventory.ammo.counts[AmmoType.Cells] < 1) {
        // TODO: Switch weapon
        return;
    }

    inventory.ammo.counts[AmmoType.Cells]--;

    const damage = 15; // Base damage
    const kick = 2; // Kickback

    const end = addVec3(start, scaleVec3(forward, 8192));

    const trace = game.trace(start, null, null, end, player, 0x00000001 | 0x00000010 | 0x00000002 | 0x00000004); // MASK_SHOT

    // Apply Damage
    if (trace.ent && trace.ent.takedamage) {
        T_Damage(
            trace.ent as any,
            player as any,
            player as any,
            forward, // direction
            trace.endpos,
            trace.plane ? trace.plane.normal : ZERO_VEC3,
            damage,
            0, // No knockback on hit? Or maybe standard?
            DamageFlags.ENERGY,
            DamageMod.HEATBEAM,
            game.time,
            game.multicast
        );
    }

    // Visuals
    // TE_HEATBEAM
    // WriteShort(start) WriteShort(end)
    game.multicast(player.origin, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.HEATBEAM, start, trace.endpos);

    // Sparks at impact
    if (trace.fraction < 1.0) {
        game.multicast(trace.endpos, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.HEATBEAM_SPARKS, trace.endpos, trace.plane ? trace.plane.normal : ZERO_VEC3);
    }

    // Player Kick / Recoil
    applyKick(player, -0.5, 0, 0);
}

// Rogue Ion Ripper
// Source: xatrix/p_xatrix_weapon.cpp
export function fireIonRipper(game: GameExports, player: Entity, inventory: PlayerInventory, weaponState: WeaponState) {
    if (inventory.ammo.counts[AmmoType.Cells] < 2) {
        return;
    }

    const damage = game.deathmatch ? 30 : 50;

    // Spread: tempang[YAW] += crandom();
    // We need to calculate start and forward here.
    const tempAng = { ...player.angles };
    tempAng.y += game.random.crandom();

    const { forward } = angleVectors(tempAng);
    const { right, up } = angleVectors(player.angles); // Only yaw affected? No, P_ProjectSource uses full angles.
    // Actually source C++ code:
    // tempang = ent->client->v_angle;
    // tempang[YAW] += crandom();
    // P_ProjectSource(ent, tempang, { 16, 7, -8 }, start, dir);
    // So P_ProjectSource uses the MODIFIED angles for both START and DIR?
    // "AngleVectors(angles, forward, right, up);" inside P_ProjectSource.
    // Yes.

    // So we need to call angleVectors with tempAng to get forward, right, up for P_ProjectSource.
    const { forward: fwd2, right: right2, up: up2 } = angleVectors(tempAng);

    const source = P_ProjectSource(game, player, { x: 16, y: 7, z: -8 }, fwd2, right2, up2);

    inventory.ammo.counts[AmmoType.Cells] -= 2;

    game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_IONRIPPER);
    applyKick(player, -3, 0, 0);

    const speed = 500;
    createIonRipper(game.entities, player, source, fwd2, damage, speed);
}

// Rogue Phalanx (Mag Slug)
// Source: xatrix/p_xatrix_weapon.cpp
export function firePhalanx(game: GameExports, player: Entity, inventory: PlayerInventory, weaponState: WeaponState) {
    if (inventory.ammo.counts[AmmoType.MagSlugs] < 1) {
        return;
    }

    inventory.ammo.counts[AmmoType.MagSlugs]--;

    const damage = game.random.irandomRange(70, 80);
    const speed = 725; // 700 in my previous reading? C++ says 725.

    let yawOffset = 0;
    let frameRadiusDamage = 120;
    let flash = MZ_PHALANX;

    // Frame logic
    const frame = player.client ? player.client.gun_frame : 0;
    if (frame === 8) {
        yawOffset = -1.5;
        frameRadiusDamage = 30;
        flash = MZ_PHALANX2;
    } else {
        yawOffset = 1.5;
        frameRadiusDamage = 120;
        flash = MZ_PHALANX;
    }

    // Note: C++ uses different P_ProjectSource args for frame 8?
    // if (frame == 8) ... P_ProjectSource(ent, v, { 0, 8, -8 }, start, dir);
    // else ... P_ProjectSource(ent, v, { 0, 8, -8 }, start, dir);
    // Identical offset { 0, 8, -8 }.

    const tempAng = { ...player.angles };
    tempAng.y += yawOffset;

    const { forward: fwd2, right: right2, up: up2 } = angleVectors(tempAng);
    const source = P_ProjectSource(game, player, { x: 0, y: 8, z: -8 }, fwd2, right2, up2);

    game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, flash);
    applyKick(player, -2, 0, 0);

    createPhalanxBall(game.entities, player, source, fwd2, damage, frameRadiusDamage, speed);
}

// Rogue ETF Rifle (Flechette Gun)
// Source: g_rogue_weapon.c
export function fireEtfRifle(game: GameExports, player: Entity, inventory: PlayerInventory, weaponState: WeaponState, start: Vec3, forward: Vec3) {
    if (inventory.ammo.counts[AmmoType.Flechettes] < 1) {
        return;
    }

    inventory.ammo.counts[AmmoType.Flechettes]--;

    game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_MACHINEGUN); // Placeholder
    applyKick(player, -1, 0, 0);

    const damage = 10;
    const speed = 900;

    createFlechette(game.entities, player, start, forward, damage, speed);
}
