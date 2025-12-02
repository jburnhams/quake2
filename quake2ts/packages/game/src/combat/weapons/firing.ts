// =================================================================
// Quake II - Weapon Firing
// =================================================================

import { Entity } from '../../entities/entity.js';
import { GameExports } from '../../index.js';
import { getWeaponState, WeaponState } from './state.js';
import { WEAPON_ITEMS, WeaponItem } from '../../inventory/items.js';
import { PlayerInventory, WeaponId } from '../../inventory/playerInventory.js';
import { AmmoType } from '../../inventory/ammo.js';
import {
    ZERO_VEC3, angleVectors, addVec3, scaleVec3, createRandomGenerator, ServerCommand, TempEntity, Vec3,
    MZ_BLASTER, MZ_MACHINEGUN, MZ_SHOTGUN, MZ_CHAINGUN1, MZ_CHAINGUN2, MZ_CHAINGUN3,
    MZ_RAILGUN, MZ_ROCKET, MZ_GRENADE, MZ_LOGIN, MZ_LOGOUT, MZ_SSHOTGUN, MZ_BFG, MZ_HYPERBLASTER
} from '@quake2ts/shared';
import { T_Damage, T_RadiusDamage } from '../damage.js';
import { DamageFlags } from '../damageFlags.js';
import { DamageMod } from '../damageMods.js';
import { createRocket, createGrenade, createBfgBall, createBlasterBolt, createProxMine } from '../../entities/projectiles.js';
import { MulticastType } from '../../imports.js';
import { fireIonRipper, firePhalanx, firePlasmaBeam, fireEtfRifle } from './rogue.js';
import { P_ProjectSource } from './projectSource.js';
import { Throw_Generic } from './animation.js';
import {
    FRAME_GRENADE_IDLE_FIRST, FRAME_GRENADE_IDLE_LAST, FRAME_GRENADE_THROW_FIRST,
    FRAME_GRENADE_THROW_LAST, FRAME_GRENADE_PRIME_SOUND, FRAME_GRENADE_THROW_HOLD,
    FRAME_GRENADE_THROW_FIRE
} from './frames.js';

const random = createRandomGenerator();
export { random as firingRandom };

function applyKick(player: Entity, pitch: number, yaw: number = 0, kickOrigin: number = 0) {
    if (player.client) {
        player.client.kick_angles = { x: pitch, y: yaw, z: 0 };
        player.client.kick_origin = { x: kickOrigin, y: 0, z: 0 };
    }
}

function fireHitscan(game: GameExports, player: Entity, start: Vec3, forward: any, damage: number, knockback: number, mod: DamageMod) {
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
            game.time,
            game.multicast
        );
    } else {
        // Wall impact
        if (trace.plane) {
            game.multicast(trace.endpos, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.GUNSHOT, trace.endpos, trace.plane.normal);
        }
    }
}

function fireMultiplePellets(game: GameExports, player: Entity, start: Vec3, forward: Vec3, right: Vec3, up: Vec3, count: number, damage: number, knockback: number, hspread: number, vspread: number, mod: DamageMod) {
    for (let i = 0; i < count; i++) {
        const spread = addVec3(scaleVec3(right, random.crandom() * hspread), scaleVec3(up, random.crandom() * vspread));
        const dir = addVec3(forward, spread);
        const end = { x: start.x + dir.x * 8192, y: start.y + dir.y * 8192, z: start.z + dir.z * 8192 };
        const trace = game.trace(start, null, null, end, player, 0);

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
                game.time,
                game.multicast
            );
        } else if (trace.plane) {
            if (random.frandom() > 0.9) {
                game.multicast(trace.endpos, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.GUNSHOT, trace.endpos, trace.plane.normal);
            }
        }
    }
}

function fireRailgun(game: GameExports, player: Entity, start: Vec3, forward: any, damage: number, knockback: number) {
    const originalStart = { ...start }; // Keep original start for trail
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
                game.time,
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

    game.multicast(originalStart, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.RAILTRAIL, originalStart, finalEnd);
}

function fireHandGrenade(game: GameExports, player: Entity, inventory: PlayerInventory, weaponState: WeaponState) {
    if (inventory.ammo.counts[AmmoType.Grenades] < 1) {
        // TODO: NoAmmoWeaponChange
        // For now, if no ammo, we can't start throw.
        // But what if we are already in throw sequence?
        // Throw_Generic handles that? No, Throw_Generic is called from here.
        // We should allow finishing the throw if we are in state?
        // Actually, logic is: "If we can't fire, we switch."
        // But if we are in animation, we continue.

        // Let's assume NoAmmo check is done before entering this if starting new.
    }

    // Call Throw_Generic which handles the state machine for the grenade
    Throw_Generic(
        player,
        FRAME_GRENADE_THROW_LAST, // FRAME_FIRE_LAST (end of throw sequence)
        FRAME_GRENADE_IDLE_LAST,  // FRAME_IDLE_LAST
        FRAME_GRENADE_THROW_FIRST,
        FRAME_GRENADE_THROW_LAST,
        FRAME_GRENADE_PRIME_SOUND,
        FRAME_GRENADE_THROW_HOLD,
        FRAME_GRENADE_THROW_FIRE,
        (ent: Entity, held: boolean) => {
            // FIRE callback

            // Consume ammo
            if (ent.client) {
                ent.client.inventory.ammo.counts[AmmoType.Grenades]--;
            }

            if (held) {
                 // Explode in hand
                const dmg = 120;
                T_RadiusDamage([ent] as any, ent as any, ent as any, dmg, ent as any, 120, DamageFlags.NONE, DamageMod.GRENADE, game.time, {}, game.multicast);
                game.multicast(ent.origin, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.GRENADE_EXPLOSION, ent.origin);
                // No kick, no muzzleflash
            } else {
                // Actual throw
                // heldTime determines speed
                // In Throw_Generic, we don't pass heldTime directly, but we can access it via grenade_time logic if needed?
                // Or we recalculate based on animation frames?
                // Wait, Throw_Generic handles timing.

                // Original Q2 calculates strength based on (timer - level.time).
                // We stored start time in grenade_time? No, grenade_time was expiration time.
                // We need the START time of holding.
                // But `grenade_time` in Throw_Generic (p_weapon.cpp) is actually the EXPLOSION time.
                // So held time = 3.2 - (grenade_time - current_time) approx.
                // Since grenade_time = start_time + 3.2.
                // So grenade_time - current_time = time_left.
                // 3.2 - time_left = held_time.

                let heldTime = 0;
                if (ent.client && ent.client.grenade_time) {
                    const timeLeft = ent.client.grenade_time - game.time;
                    heldTime = 3.0 - timeLeft; // Using 3.0 as per our logic in animation.ts
                }

                if (heldTime < 0) heldTime = 0;

                let speed = 400 + (heldTime * 200);
                if (speed > 800) speed = 800;

                let timer = 2.5 - heldTime;
                if (timer < 0.5) timer = 0.5;

                game.multicast(ent.origin, MulticastType.Pvs, ServerCommand.muzzleflash, ent.index, MZ_GRENADE);
                applyKick(ent, -2, 0, -2);

                let throwAngles = { ...ent.angles };
                if (throwAngles.x < -62.5) throwAngles.x = -62.5;
                throwAngles.z = 0;

                const { forward } = angleVectors(throwAngles);
                const { right, up } = angleVectors(ent.angles);

                const source = P_ProjectSource(game, ent, { x: 2, y: 0, z: -14 }, forward, right, up);

                createGrenade(game.entities, ent, source, forward, 120, speed, timer);
            }
        },
        game.entities // EntitySystem
    );
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

    // Weapon Animation System Intercept
    // If using new system, we delegate to the animation/think function instead of raw firing.
    // For Hand Grenade, we use fireHandGrenade which uses Throw_Generic.

    if (weaponId === WeaponId.HandGrenade) {
        fireHandGrenade(game, player, inventory, weaponState);
        return;
    }

    // For other weapons, we still use the old "fire check" for now until we move them to Weapon_Generic.
    // But wait, the task is to implement the system.
    // If we want to use Weapon_Generic, we should call it here?
    // No, Weapon_Generic is called from the weapon's Think function.
    // The `fire` function here is the `fire` callback passed to Weapon_Generic.

    // CURRENT ARCHITECTURE:
    // `player_think` calls `weaponItem.think`.
    // Currently `weaponItem.think` is not fully implemented or calls `fire` directly?
    // Let's check `items.ts` or `playerInventory.ts`.

    // If `fire` is called directly from `player_think` (via some mechanism), then we are bypassing animation.
    // We need to change `weaponItem.think` to call `Weapon_Generic` (or `fireHandGrenade`).

    // This `fire` function seems to be the "Act of Firing".
    // It checks fire rate `lastFireTime`.

    // For the transition:
    // We should keep this function as the "Do the shot" logic.
    // But the TIMING and ANIMATION should be handled by `Weapon_Generic`.

    // So `Weapon_Generic` calls `fire(ent)`.
    // And `fire(ent)` calls `fire(game, ent, weaponId)`?

    // But `fire` here also checks `lastFireTime`.
    // `Weapon_Generic` handles timing via frames.

    // So we should remove `lastFireTime` check from here if called via `Weapon_Generic`.

    // However, `fireHandGrenade` is special.

    // Let's assume we are only converting Hand Grenade fully for now.
    // Other weapons continue using the old system until we convert them.

    if (game.time < weaponState.lastFireTime) {
        return;
    }

    const { forward, right, up } = angleVectors(player.angles);

    // Default offset for most weapons: {8, 8, -8} (approx gun height)
    // Note: original source logic uses 'viewheight-8' in Z offset and adds to origin.
    // Our P_ProjectSource logic adds to (origin + viewheight).
    // So if we want Z to be 'viewheight-8' above origin, then Z offset should be -8.
    // (origin + viewheight) + (-8) = origin + viewheight - 8. Correct.
    const defaultOffset = { x: 8, y: 8, z: -8 };
    const source = P_ProjectSource(game, player, defaultOffset, forward, right, up);

    switch (weaponId) {
        case WeaponId.Shotgun: {
            if (inventory.ammo.counts[AmmoType.Shells] < 1) {
                return;
            }
            // Ref: g_weapon.c -> weapon_shotgun_fire
            inventory.ammo.counts[AmmoType.Shells]--;
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_SHOTGUN);
            applyKick(player, -2, 0, -2);
            fireMultiplePellets(game, player, source, forward, right, up, 12, 4, 1, 500, 500, DamageMod.SHOTGUN);
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
            // Source: ../rerelease/p_weapon.cpp:1745-1752
            // We need new vectors but same source point (approx)
            const { forward: forward1, right: right1, up: up1 } = angleVectors({ ...player.angles, y: player.angles.y - 5 });
            fireMultiplePellets(game, player, source, forward1, right1, up1, 10, 6, 1, 700, 700, DamageMod.SSHOTGUN);
            const { forward: forward2, right: right2, up: up2 } = angleVectors({ ...player.angles, y: player.angles.y + 5 });
            fireMultiplePellets(game, player, source, forward2, right2, up2, 10, 6, 1, 700, 700, DamageMod.SSHOTGUN);
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
            fireHitscan(game, player, source, forward, 8, 1, DamageMod.MACHINEGUN);
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
            } else {
                if (spinupCount <= 10) { // Frames 10-14 in original
                    shots = 2;
                } else { // Frames 15+
                    shots = 3;
                }
                game.sound(player, 0, "weapons/chngnl1a.wav", 1, 0, 0);
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
                fireHitscan(game, player, source, dir, damage, knockback, DamageMod.CHAINGUN);
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
            // Railgun often uses {0, 0, -8} or {8, 8, -8}?
            // Stick with standard defaultOffset for now.
            fireRailgun(game, player, source, forward, damage, knockback);
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
            // Source: ../rerelease/p_weapon.cpp:1419-1422
            const damage = game.deathmatch ? 15 : 20;
            createBlasterBolt(game.entities, player, source, forward, damage, 1000, DamageMod.HYPERBLASTER);
            break;
        }
        case WeaponId.Blaster: {
            // Ref: g_weapon.c -> weapon_blaster_fire
            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_BLASTER);
            applyKick(player, -0.5, 0, 0);
            // Ref: p_weapon.cpp:1340 - BLASTER_SPEED 1500
            createBlasterBolt(game.entities, player, source, forward, 15, 1500, DamageMod.BLASTER);
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
            // Source: ../rerelease/p_weapon.cpp:1284-1291
            const damage = 100 + game.random.irandom(21); // 100-120 damage
            const radiusDamage = 120;
            createRocket(game.entities, player, source, forward, damage, radiusDamage, 650);
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
            createGrenade(game.entities, player, source, forward, 120, 600);
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
            // Source: ../rerelease/p_weapon.cpp:1845-1848
            const damage = game.deathmatch ? 200 : 500;
            createBfgBall(game.entities, player, source, forward, damage, 400, 200);
            break;
        }
        case WeaponId.PlasmaBeam: {
            firePlasmaBeam(game, player, inventory, weaponState, source, forward);
            break;
        }
        case WeaponId.IonRipper: {
            fireIonRipper(game, player, inventory, weaponState, source, forward);
            break;
        }
        case WeaponId.Phalanx: {
            firePhalanx(game, player, inventory, weaponState, source, forward);
            break;
        }
        case WeaponId.EtfRifle: {
            fireEtfRifle(game, player, inventory, weaponState, source, forward);
            break;
        }
        case WeaponId.ProxLauncher: {
             if (inventory.ammo.counts[AmmoType.Prox] < 1) {
                // TODO: NoAmmoWeaponChange
                return;
            }
            inventory.ammo.counts[AmmoType.Prox]--;

            game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_GRENADE); // Use grenade flash for now
            applyKick(player, -2, 0, -2);

            // Speed 600
            createProxMine(game.entities, player, source, forward, 600);
            break;
        }
    }

    weaponState.lastFireTime = game.time + weaponItem.fireRate;
}
