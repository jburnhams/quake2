// =================================================================
// Quake II - Rogue Mission Pack Weapons
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { GameExports } from '../../index.js';
import { getWeaponState, WeaponState } from './state.js';
import { PlayerInventory, WeaponId } from '../../inventory/playerInventory.js';
import { AmmoType } from '../../inventory/ammo.js';
import {
    ZERO_VEC3, angleVectors, addVec3, scaleVec3, ServerCommand, TempEntity, Vec3,
    MZ_BLASTER, MZ_MACHINEGUN, MZ_SHOTGUN, MZ_CHAINGUN1, MZ_CHAINGUN2, MZ_CHAINGUN3,
    MZ_RAILGUN, MZ_ROCKET, MZ_GRENADE, MZ_LOGIN, MZ_LOGOUT, MZ_SSHOTGUN, MZ_BFG, MZ_HYPERBLASTER
} from '@quake2ts/shared';
import { T_Damage, T_RadiusDamage } from '../damage.js';
import { DamageFlags } from '../damageFlags.js';
import { DamageMod } from '../damageMods.js';
import { MulticastType } from '../../imports.js';
import { firingRandom } from './firing.js';
import { createIonRipper, createPhalanxBall, createFlechette } from '../../entities/projectiles.js';
import { Weapon_Repeating } from './animation.js';
import {
    FRAME_CHAINGUN_FIRE_FRAME, FRAME_CHAINGUN_FIRE_LAST,
    FRAME_CHAINGUN_IDLE_LAST, FRAME_CHAINGUN_DEACTIVATE_LAST
} from './frames.js';

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
// Source: g_rogue_weapon.c
export function fireIonRipper(game: GameExports, player: Entity, inventory: PlayerInventory, weaponState: WeaponState, start: Vec3, forward: Vec3) {
    const ammoCost = 2;
    if (inventory.ammo.counts[AmmoType.Cells] < ammoCost) {
        // TODO: Switch weapon
        return;
    }

    inventory.ammo.counts[AmmoType.Cells] -= ammoCost;

    game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_ROCKET); // Placeholder flash
    applyKick(player, -2, 0, 0);

    // Ref: g_rogue_weapon.c -> fire_ionripper (ent, start, dir, 30, 500, EF_IONRIPPER);
    const damage = 30;
    const speed = 500;

    createIonRipper(game.entities, player, start, forward, damage, speed);
}

// Rogue Phalanx (Mag Slug)
// Source: g_rogue_weapon.c
export function firePhalanx(game: GameExports, player: Entity, inventory: PlayerInventory, weaponState: WeaponState, start: Vec3, forward: Vec3) {
    if (inventory.ammo.counts[AmmoType.MagSlugs] < 1) {
        return;
    }

    inventory.ammo.counts[AmmoType.MagSlugs]--;

    game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_ROCKET); // Placeholder
    applyKick(player, -2, 0, 0);

    const damage = 70; // Damage + 120 radius
    const radiusDamage = 120;
    const speed = 700;

    // Fire 2 balls with slight spread (+/- 2.5 degrees)
    const angles1 = { ...player.angles };
    angles1.y -= 2.5;
    const { forward: dir1 } = angleVectors(angles1);
    createPhalanxBall(game.entities, player, start, dir1, damage, radiusDamage, speed);

    const angles2 = { ...player.angles };
    angles2.y += 2.5;
    const { forward: dir2 } = angleVectors(angles2);
    createPhalanxBall(game.entities, player, start, dir2, damage, radiusDamage, speed);
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

// Rogue Chainfist
// Source: g_rogue_weapon.c
export function fireChainFist(game: GameExports, player: Entity, inventory: PlayerInventory, weaponState: WeaponState, start: Vec3, forward: Vec3) {
    const damage = 15; // Per frame (approx 150 DPS)
    const range = 64;

    const end = addVec3(start, scaleVec3(forward, range));

    // Trace for hit
    const trace = game.trace(start, null, null, end, player, 0x00000001 | 0x00000010 | 0x00000002 | 0x00000004); // MASK_SHOT

    if (trace.fraction < 1.0 && trace.ent) {
        // Hit something
        if (trace.ent.takedamage) {
            T_Damage(
                trace.ent as any,
                player as any,
                player as any,
                forward,
                trace.endpos,
                trace.plane ? trace.plane.normal : ZERO_VEC3,
                damage,
                0, // No knockback
                DamageFlags.NONE,
                DamageMod.CHAINFIST,
                game.time,
                game.multicast
            );
            // Hit sound
            if (Math.random() < 0.3)
                game.sound(player, 1, "weapons/machgf1b.wav", 1, 1, 0); // Placeholder
        } else {
            // Hit wall
            if (Math.random() < 0.3)
                game.sound(player, 1, "weapons/machgf1b.wav", 1, 1, 0); // Placeholder
        }

        // Sparks
        if (trace.plane) {
             game.multicast(trace.endpos, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.SPARKS, trace.endpos, trace.plane.normal);
        }
    } else {
        // Miss (idle revving)
        if (Math.random() < 0.1)
            game.sound(player, 1, "weapons/machgf1b.wav", 1, 1, 0); // Placeholder
    }

    applyKick(player, -0.5, 0, 0);
}

export function chainfistThink(player: Entity, sys: EntitySystem) {
    // Reuse frames from Chaingun for now as placeholders for continuous fire
    const fire = (ent: Entity) => {
        const game = {
            trace: (start: any, mins: any, maxs: any, end: any, passent: any, mask: any) => sys.trace(start, mins, maxs, end, passent, mask),
            multicast: (origin: any, type: any, event: any, ...args: any[]) => {
                if (sys.engine.multicast) sys.engine.multicast(origin, type, event, ...args);
            },
            time: sys.timeSeconds,
            entities: sys,
            deathmatch: sys.deathmatch,
            random: (sys as any).random,
            sound: sys.sound.bind(sys)
        } as unknown as GameExports;

        // P_ProjectSource or similar logic for start/forward
        // Simplified for now (from player eyes)
        const angles = { ...ent.angles };
        angles.z = 0;
        const vectors = angleVectors(angles);
        const start = { ...ent.origin };
        start.z += ent.viewheight;

        if (ent.client)
            fireChainFist(game, ent, ent.client.inventory, {} as any, start, vectors.forward);
    };

    Weapon_Repeating(
        player,
        FRAME_CHAINGUN_FIRE_FRAME,
        FRAME_CHAINGUN_FIRE_LAST,
        FRAME_CHAINGUN_IDLE_LAST,
        0,
        0,
        fire,
        sys
    );
}
