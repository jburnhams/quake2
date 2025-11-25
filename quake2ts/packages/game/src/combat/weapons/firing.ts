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

function fireHitscan(game: GameExports, player: Entity, start: any, forward: any, damage: number, knockback: number, mod: DamageMod) {
    const end = { x: start.x + forward.x * 8192, y: start.y + forward.y * 8192, z: start.z + forward.z * 8192 };
    const trace = game.trace(
        start,
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

function fireRailgun(game: GameExports, player: Entity, start: any, forward: any, damage: number, knockback: number) {
    let currentStart = { ...start };
    const end = { x: start.x + forward.x * 8192, y: start.y + forward.y * 8192, z: start.z + forward.z * 8192 };
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

    game.multicast(start, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.RAILTRAIL, start, finalEnd);
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
    const start = addVec3(player.origin, { x: 0, y: 0, z: player.viewheight });

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
                const end = { x: start.x + dir.x * 8192, y: start.y + dir.y * 8192, z: start.z + dir.z * 8192 };
                const trace = game.trace(
                    start,
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
                const end = { x: start.x + dir.x * 8192, y: start.y + dir.y * 8192, z: start.z + dir.z * 8192 };
                const trace = game.trace(
                    start,
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
            fireHitscan(game, player, start, forward, 8, 1, DamageMod.MACHINEGUN);
            break;
        }
        case WeaponId.Chaingun: {
            if (inventory.ammo.counts[AmmoType.Bullets] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_chaingun_fire
            inventory.ammo.counts[AmmoType.Bullets]--;
            // Chaingun has rotating flash MZ_CHAINGUN1, 2, 3

            const chaingunState = getWeaponState(player.client.weaponStates, WeaponId.Chaingun);
            const shots = chaingunState.shots || 0;
            chaingunState.shots = shots + 1;

            const flash = MZ_CHAINGUN1 + (shots % 3);
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, flash);
            applyKick(player, -0.5, random.crandom() * 0.5, 0);
            fireHitscan(game, player, start, forward, 8, 1, DamageMod.CHAINGUN);
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
            fireRailgun(game, player, start, forward, 150, 1);
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
            return createBlasterBolt(game.entities, player, start, forward, 20, 1000, DamageMod.HYPERBLASTER);
        }
        case WeaponId.Blaster: {
            // Ref: g_weapon.c -> weapon_blaster_fire
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_BLASTER);
            applyKick(player, -0.5, 0, 0);
            return createBlasterBolt(game.entities, player, start, forward, 15, 1000, DamageMod.BLASTER);
        }

        case WeaponId.RocketLauncher: {
            if (inventory.ammo.counts[AmmoType.Rockets] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_rocketlauncher_fire
            inventory.ammo.counts[AmmoType.Rockets]--;
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_ROCKET);
            applyKick(player, -2, 0, -2);
            return createRocket(game.entities, player, start, forward, 100, 650);
        }
        case WeaponId.GrenadeLauncher: {
            if (inventory.ammo.counts[AmmoType.Grenades] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_grenadelauncher_fire
            inventory.ammo.counts[AmmoType.Grenades]--;
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_GRENADE);
            applyKick(player, -2, 0, -2);
            return createGrenade(game.entities, player, start, forward, 120, 600);
        }
        case WeaponId.BFG10K: {
            if (inventory.ammo.counts[AmmoType.Cells] < 50) {
                return;
            }
            // Ref: g_weapon.c -> weapon_bfg_fire
            inventory.ammo.counts[AmmoType.Cells] -= 50;
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_BFG);
            applyKick(player, -5, 0, -2);
            return createBfgBall(game.entities, player, start, forward, 200, 400, 1000);
        }
    }

    weaponState.lastFireTime = game.time + weaponItem.fireRate;
}
