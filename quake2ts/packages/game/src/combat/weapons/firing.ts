// =================================================================
// Quake II - Weapon Firing
// =================================================================

import { Entity } from '../../entities/entity.js';
import { GameExports } from '../../index.js';
import { getWeaponState } from './state.js';
import { WEAPON_ITEMS, WeaponItem } from '../../inventory/items.js';
import { PlayerInventory, WeaponId } from '../../inventory/playerInventory.js';
import { AmmoType } from '../../inventory/ammo.js';
import { T_Damage } from '../damage.js';
import { ZERO_VEC3, angleVectors, addVec3, scaleVec3, createRandomGenerator, ServerCommand, TempEntity } from '@quake2ts/shared';
import { DamageFlags } from '../damageFlags.js';
import { DamageMod } from '../damageMods.js';
import { createRocket, createGrenade, createBfgBall, createBlasterBolt } from '../../entities/projectiles.js';
import { MulticastType } from '../../imports.js';

const random = createRandomGenerator();

// Quake 2 Muzzle Flash Constants (from g_local.h / q_shared.h)
const MZ_BLASTER = 0;
const MZ_MACHINEGUN = 1;
const MZ_SHOTGUN = 2;
const MZ_CHAINGUN1 = 3;
const MZ_CHAINGUN2 = 4;
const MZ_CHAINGUN3 = 5;
const MZ_RAILGUN = 6;
const MZ_ROCKET = 7;
const MZ_GRENADE = 8;
const MZ_LOGIN = 9;
const MZ_LOGOUT = 10;
const MZ_SSHOTGUN = 11;
const MZ_BFG = 12;
const MZ_HYPERBLASTER = 13;

function applyKick(player: Entity, pitch: number, yaw: number = 0, kickOrigin: number = 0) {
    if (player.client) {
        player.client.kick_angles = { x: pitch, y: yaw, z: 0 };
        player.client.kick_origin = { x: kickOrigin, y: 0, z: 0 };
    }
}

function fireHitscan(game: GameExports, player: Entity, forward: any, damage: number, knockback: number, mod: DamageMod) {
    const end = { x: player.origin.x + forward.x * 8192, y: player.origin.y + forward.y * 8192, z: player.origin.z + forward.z * 8192 };
    const trace = game.trace(
        player.origin,
        null,
        null,
        end,
        player,
        0
    );

    if (trace.ent && trace.ent.takedamage) {
        T_Damage(
            trace.ent as any,
            player as any,
            player as any,
            ZERO_VEC3,
            trace.endpos,
            trace.plane ? trace.plane.normal : ZERO_VEC3,
            damage,
            knockback,
            DamageFlags.BULLET,
            mod,
            game.multicast
        );
    } else {
        // Wall impact
        if (trace.plane) {
            game.multicast(trace.endpos, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.GUNSHOT, trace.endpos, trace.plane.normal);
        }
    }
}

function fireRailgun(game: GameExports, player: Entity, forward: any, damage: number, knockback: number) {
    const start = { ...player.origin }; // Keep original start for trail
    let currentStart = { ...player.origin };
    const end = { x: player.origin.x + forward.x * 8192, y: player.origin.y + forward.y * 8192, z: player.origin.z + forward.z * 8192 };
    let ignore = player;
    let count = 0;
    let finalEnd = end;

    while (count < 16) { // Safety break
        count++;
        const trace = game.trace(currentStart, null, null, end, ignore, 0);

        finalEnd = trace.endpos;

        if (trace.fraction >= 1.0) {
            break;
        }

        if (trace.ent && trace.ent.takedamage) {
             T_Damage(
                trace.ent as any,
                player as any,
                player as any,
                ZERO_VEC3,
                trace.endpos,
                trace.plane ? trace.plane.normal : ZERO_VEC3,
                damage,
                knockback,
                DamageFlags.ENERGY,
                DamageMod.RAILGUN,
                game.multicast
            );
        }

        // Continue trace from hit point
        ignore = trace.ent as Entity;
        currentStart = trace.endpos;

        // If we hit world geometry, we stop.
        if (!trace.ent || trace.ent === game.entities.world) {
            break;
        }
    }

    // Railgun trail
    // gi.WriteByte (svc_temp_entity);
    // gi.WriteByte (TE_RAILTRAIL);
    // gi.WritePosition (start);
    // gi.WritePosition (tr.endpos);
    // gi.multicast (start, MULTICAST_PHS);

    // Adjust start to eye position? Usually gun height.
    // Assuming player.origin is good enough for now or we should add viewheight.
    const trailStart = { ...start };
    trailStart.z += player.viewheight - 8; // Rough adjustment

    game.multicast(start, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.RAILTRAIL, trailStart, finalEnd);
}

export function fire(game: GameExports, player: Entity, weaponId: WeaponId) {
    if (!player.client) {
        return;
    }

    const inventory = player.client.inventory;
    const weaponItem = Object.values(WEAPON_ITEMS).find(item => item.weaponId === weaponId);

    if (!weaponItem) {
        return;
    }

    const weaponState = getWeaponState(player.client.weaponStates, weaponId);

    if (game.time < weaponState.lastFireTime) {
        return;
    }

    const { forward, right, up } = angleVectors(player.angles);

    switch (weaponId) {
        case WeaponId.Shotgun: {
            if (inventory.ammo.counts[AmmoType.Shells] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_shotgun_fire
            inventory.ammo.counts[AmmoType.Shells]--;
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_SHOTGUN);
            applyKick(player, -2, 0, -2);

            for (let i = 0; i < 12; i++) {
                const spread = addVec3(scaleVec3(right, random.crandom() * 500), scaleVec3(up, random.crandom() * 500));
                const dir = addVec3(forward, spread);
                const end = { x: player.origin.x + dir.x * 8192, y: player.origin.y + dir.y * 8192, z: player.origin.z + dir.z * 8192 };
                const trace = game.trace(
                    player.origin,
                    null,
                    null,
                    end,
                    player,
                    0
                );

                if (trace.ent && trace.ent.takedamage) {
                    T_Damage(
                        trace.ent as any,
                        player as any,
                        player as any,
                        ZERO_VEC3,
                        trace.endpos,
                        trace.plane ? trace.plane.normal : ZERO_VEC3,
                        4,
                        1,
                        DamageFlags.BULLET,
                        DamageMod.SHOTGUN,
                        game.multicast
                    );
                } else if (trace.plane) {
                     // Impact effect for shotgun pellets?
                     // Quake 2 doesn't spawn 12 sparks, maybe just some?
                     // Original: fire_shotgun calls fire_lead which calls fire_hit
                     // fire_hit calls CheckTrace -> if !takedamage, writes TE_GUNSHOT
                     // Don't spam multicast for shotgun pellets
                     if (random.frandom() > 0.8) {
                        game.multicast(trace.endpos, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.GUNSHOT, trace.endpos, trace.plane.normal);
                     }
                }
            }
            break;
        }
        case WeaponId.SuperShotgun: {
            if (inventory.ammo.counts[AmmoType.Shells] < 2) {
                return;
            }
            // Ref: g_weapon.c -> weapon_sshotgun_fire
            inventory.ammo.counts[AmmoType.Shells] -= 2;
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_SSHOTGUN);
            applyKick(player, -4, 0, -4);

            for (let i = 0; i < 20; i++) {
                const spread = addVec3(scaleVec3(right, random.crandom() * 700), scaleVec3(up, random.crandom() * 700));
                const dir = addVec3(forward, spread);
                const end = { x: player.origin.x + dir.x * 8192, y: player.origin.y + dir.y * 8192, z: player.origin.z + dir.z * 8192 };
                const trace = game.trace(
                    player.origin,
                    null,
                    null,
                    end,
                    player,
                    0
                );

                if (trace.ent && trace.ent.takedamage) {
                    T_Damage(
                        trace.ent as any,
                        player as any,
                        player as any,
                        ZERO_VEC3,
                        trace.endpos,
                        trace.plane ? trace.plane.normal : ZERO_VEC3,
                        6,
                        1,
                        DamageFlags.BULLET,
                        DamageMod.SSHOTGUN,
                        game.multicast
                    );
                } else if (trace.plane) {
                     if (random.frandom() > 0.9) {
                        game.multicast(trace.endpos, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.GUNSHOT, trace.endpos, trace.plane.normal);
                     }
                }
            }
            break;
        }
        case WeaponId.Machinegun: {
            if (inventory.ammo.counts[AmmoType.Bullets] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_machinegun_fire
            inventory.ammo.counts[AmmoType.Bullets]--;
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_MACHINEGUN);
            applyKick(player, -1, random.crandom() * 0.5, 0);
            fireHitscan(game, player, forward, 8, 1, DamageMod.MACHINEGUN);
            break;
        }
        case WeaponId.Chaingun: {
            // Source: rerelease/p_weapon.cpp -> Chaingun_Fire

            const chaingunState = getWeaponState(player.client.weaponStates, WeaponId.Chaingun);

            // Reset spin-up if the player hasn't fired in a while (original uses animation frames)
            // 200ms is a bit more than the time between shots, acting as a debounce.
            if (game.time - weaponState.lastFireTime > 200) {
                chaingunState.spinupCount = 0;
            }

            const spinupCount = (chaingunState.spinupCount || 0) + 1;
            chaingunState.spinupCount = spinupCount;

            let shots;
            if (spinupCount <= 5) { // Frames 5-9 in original
                shots = 1;
                if (spinupCount === 1) {
                    game.sound(player, 0, "weapons/chngnu1a.wav", 1, 0, 0);
                }
            } else if (spinupCount <= 10) { // Frames 10-14 in original
                shots = 2;
            } else { // Frames 15+
                shots = 3;
            }

            if (inventory.ammo.counts[AmmoType.Bullets] < shots) {
                shots = inventory.ammo.counts[AmmoType.Bullets];
            }

            if (shots === 0) {
                // TODO: NoAmmoWeaponChange
                return;
            }

            inventory.ammo.counts[AmmoType.Bullets] -= shots;

            const damage = game.deathmatch ? 6 : 8;
            const knockback = 1;

            // Apply kick that scales with number of shots
            applyKick(player, -0.5, random.crandom() * (0.5 + (shots * 0.15)), 0);

            for (let i = 0; i < shots; i++) {
                // Add spread, similar to original C
                const spread = addVec3(scaleVec3(right, random.crandom() * 4), scaleVec3(up, random.crandom() * 4));
                const dir = addVec3(forward, spread);
                fireHitscan(game, player, dir, damage, knockback, DamageMod.CHAINGUN);
            }

            // Muzzle flash scales with number of shots
            const flash = MZ_CHAINGUN1 + shots - 1;
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, flash);

            break;
        }
        case WeaponId.Railgun: {
            if (inventory.ammo.counts[AmmoType.Slugs] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_railgun_fire
            inventory.ammo.counts[AmmoType.Slugs]--;
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_RAILGUN);
            applyKick(player, -3, 0, -3);

            // Source: ../rerelease/p_weapon.cpp:1788-1797
            const damage = game.deathmatch ? 100 : 125;
            const knockback = game.deathmatch ? 200 : 225;
            fireRailgun(game, player, forward, damage, knockback);
            break;
        }
        case WeaponId.HyperBlaster: {
            if (inventory.ammo.counts[AmmoType.Cells] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_hyperblaster_fire
            inventory.ammo.counts[AmmoType.Cells]--;
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_HYPERBLASTER);
            applyKick(player, -0.5, 0, 0);
            createBlasterBolt(game.entities, player, player.origin, forward, 20, 1000, DamageMod.HYPERBLASTER);
            break;
        }
        case WeaponId.Blaster: {
            // Ref: g_weapon.c -> weapon_blaster_fire
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_BLASTER);
            applyKick(player, -0.5, 0, 0);
            // Ref: p_weapon.cpp:1340 - BLASTER_SPEED 1500
            createBlasterBolt(game.entities, player, player.origin, forward, 15, 1500, DamageMod.BLASTER);
            break;
        }

        case WeaponId.RocketLauncher: {
            if (inventory.ammo.counts[AmmoType.Rockets] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_rocketlauncher_fire
            inventory.ammo.counts[AmmoType.Rockets]--;
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_ROCKET);
            applyKick(player, -2, 0, -2);
            createRocket(game.entities, player, player.origin, forward, 100, 650);
            break;
        }
        case WeaponId.GrenadeLauncher: {
            if (inventory.ammo.counts[AmmoType.Grenades] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_grenadelauncher_fire
            inventory.ammo.counts[AmmoType.Grenades]--;
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_GRENADE);
            applyKick(player, -2, 0, -2);
            createGrenade(game.entities, player, player.origin, forward, 120, 600);
            break;
        }
        case WeaponId.BFG10K: {
            if (inventory.ammo.counts[AmmoType.Cells] < 50) {
                return;
            }
            // Ref: g_weapon.c -> weapon_bfg_fire
            inventory.ammo.counts[AmmoType.Cells] -= 50;
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_BFG);
            applyKick(player, -5, 0, -2);
            createBfgBall(game.entities, player, player.origin, forward, 200, 400, 200);
            break;
        }
    }

    weaponState.lastFireTime = game.time + weaponItem.fireRate;
}
