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
import { ZERO_VEC3, angleVectors, addVec3, scaleVec3, createRandomGenerator } from '@quake2ts/shared';
import { DamageFlags } from '../damageFlags.js';
import { createRocket, createGrenade, createBfgBall } from '../../entities/projectiles.js';

const random = createRandomGenerator();

function fireHitscan(game: GameExports, player: Entity, forward: any, damage: number, knockback: number) {
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
            DamageFlags.NONE,
            0
        );
    }
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
                        DamageFlags.NONE,
                        0
                    );
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
                        DamageFlags.NONE,
                        0
                    );
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
            fireHitscan(game, player, forward, 8, 1);
            break;
        }
        case WeaponId.Chaingun: {
            if (inventory.ammo.counts[AmmoType.Bullets] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_chaingun_fire
            inventory.ammo.counts[AmmoType.Bullets]--;
            fireHitscan(game, player, forward, 8, 1);
            break;
        }
        case WeaponId.Railgun: {
            if (inventory.ammo.counts[AmmoType.Slugs] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_railgun_fire
            inventory.ammo.counts[AmmoType.Slugs]--;
            fireHitscan(game, player, forward, 150, 1);
            break;
        }
        case WeaponId.HyperBlaster: {
            if (inventory.ammo.counts[AmmoType.Cells] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_hyperblaster_fire
            inventory.ammo.counts[AmmoType.Cells]--;
            fireHitscan(game, player, forward, 15, 1);
            break;
        }
        case WeaponId.Blaster: {
            // Ref: g_weapon.c -> weapon_blaster_fire
            fireHitscan(game, player, forward, 15, 1);
            break;
        }

        case WeaponId.RocketLauncher: {
            if (inventory.ammo.counts[AmmoType.Rockets] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_rocketlauncher_fire
            inventory.ammo.counts[AmmoType.Rockets]--;
            createRocket(game.entities, player, player.origin, forward, 100, 650);
            break;
        }
        case WeaponId.GrenadeLauncher: {
            if (inventory.ammo.counts[AmmoType.Grenades] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_grenadelauncher_fire
            inventory.ammo.counts[AmmoType.Grenades]--;
            createGrenade(game.entities, player, player.origin, forward, 120, 600);
            break;
        }
        case WeaponId.BFG10K: {
            if (inventory.ammo.counts[AmmoType.Cells] < 50) {
                return;
            }
            // Ref: g_weapon.c -> weapon_bfg_fire
            inventory.ammo.counts[AmmoType.Cells] -= 50;
            createBfgBall(game.entities, player, player.origin, forward, 200, 400);
            break;
        }
    }

    weaponState.lastFireTime = game.time + weaponItem.fireRate;
}
