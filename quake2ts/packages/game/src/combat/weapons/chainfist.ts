// =================================================================
// Quake II - Chainfist Weapon (Rogue Mission Pack)
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { GameExports } from '../../index.js';
import { WeaponState } from './state.js';
import { PlayerInventory } from '../../inventory/playerInventory.js';
import {
    ZERO_VEC3, angleVectors, addVec3, scaleVec3, ServerCommand, TempEntity, Vec3,
    subtractVec3, lengthVec3, dotVec3, normalizeVec3
} from '@quake2ts/shared';
import { T_Damage } from '../damage.js';
import { DamageFlags } from '../damageFlags.js';
import { DamageMod } from '../damageMods.js';
import { MulticastType } from '../../imports.js';
import { applyKick, Weapon_Repeating } from './common.js';
import { MASK_SHOT, Solid } from '../../physics/contents.js';
import {
    FRAME_crattak1, FRAME_crattak9, FRAME_attack1, FRAME_attack8, ANIM_ATTACK
} from '../../entities/player_anim.js';

const CHAINFIST_REACH = 24;

interface PlayerMeleeData {
    self: Entity;
    start: Vec3;
    aim: Vec3;
    reach: number;
}

// Ported from rereease/rogue/g_rogue_newweap.cpp: fire_player_melee_BoxFilter
function firePlayerMeleeBoxFilter(check: Entity, data: PlayerMeleeData): boolean {
    if (!check.inUse || !check.takedamage || check === data.self) {
        return false;
    }

    // Helper to find closest point on AABB to a point
    const closestPointToBox = (p: Vec3, min: Vec3, max: Vec3): Vec3 => {
        return {
            x: Math.max(min.x, Math.min(p.x, max.x)),
            y: Math.max(min.y, Math.min(p.y, max.y)),
            z: Math.max(min.z, Math.min(p.z, max.z))
        };
    };

    // check distance
    const closestPointToCheck = closestPointToBox(data.start,
        { x: check.origin.x + check.mins.x, y: check.origin.y + check.mins.y, z: check.origin.z + check.mins.z },
        { x: check.origin.x + check.maxs.x, y: check.origin.y + check.maxs.y, z: check.origin.z + check.maxs.z }
    );

    const closestPointToSelf = closestPointToBox(closestPointToCheck,
        { x: data.self.origin.x + data.self.mins.x, y: data.self.origin.y + data.self.mins.y, z: data.self.origin.z + data.self.mins.z },
        { x: data.self.origin.x + data.self.maxs.x, y: data.self.origin.y + data.self.maxs.y, z: data.self.origin.z + data.self.maxs.z }
    );

    const dir = subtractVec3(closestPointToCheck, closestPointToSelf);
    const len = lengthVec3(dir);

    if (len > data.reach) {
        return false;
    }

    // check angle if we aren't intersecting

    const checkCenter = {
        x: check.origin.x + (check.mins.x + check.maxs.x) * 0.5,
        y: check.origin.y + (check.mins.y + check.maxs.y) * 0.5,
        z: check.origin.z + (check.mins.z + check.maxs.z) * 0.5
    };

    const dirToTarget = normalizeVec3(subtractVec3(checkCenter, data.start));

    // dot check: > 0.70f (approx 45 degrees)
    if (dotVec3(dirToTarget, data.aim) < 0.70) {
         if (len > 1.0) {
             return false;
         }
    }

    return true;
}

// Ported from rereease/rogue/g_rogue_newweap.cpp: fire_player_melee
function firePlayerMelee(game: GameExports, self: Entity, start: Vec3, aim: Vec3, reach: number, damage: number, kick: number, mod: DamageMod): boolean {
    const reachVec = { x: reach, y: reach, z: reach };
    const absmin = {
        x: self.origin.x + self.mins.x - reach,
        y: self.origin.y + self.mins.y - reach,
        z: self.origin.z + self.mins.z - reach
    };
    const absmax = {
        x: self.origin.x + self.maxs.x + reach,
        y: self.origin.y + self.maxs.y + reach,
        z: self.origin.z + self.maxs.z + reach
    };

    const candidates = game.entities.findInBox(absmin, absmax);

    const data: PlayerMeleeData = { self, start, aim, reach };
    let wasHit = false;

    // Helper to find closest point on AABB to a point (re-defined here or hoisted)
    const closestPointToBox = (p: Vec3, min: Vec3, max: Vec3): Vec3 => {
        return {
            x: Math.max(min.x, Math.min(p.x, max.x)),
            y: Math.max(min.y, Math.min(p.y, max.y)),
            z: Math.max(min.z, Math.min(p.z, max.z))
        };
    };

    for (const hit of candidates) {
        if (!firePlayerMeleeBoxFilter(hit, data)) continue;

        const hitMins = { x: hit.origin.x + hit.mins.x, y: hit.origin.y + hit.mins.y, z: hit.origin.z + hit.mins.z };
        const hitMaxs = { x: hit.origin.x + hit.maxs.x, y: hit.origin.y + hit.maxs.y, z: hit.origin.z + hit.maxs.z };
        const closestPoint = closestPointToBox(start, hitMins, hitMaxs);

        T_Damage(
            hit as any,
            self as any,
            self as any,
            aim,
            closestPoint,
            scaleVec3(aim, -1),
            damage,
            kick / 2,
            DamageFlags.NO_KNOCKBACK,
            mod,
            game.time,
            game.multicast
        );

        wasHit = true;
    }

    return wasHit;
}

function chainfistSmoke(game: GameExports, ent: Entity) {

    const forward = { x: 0, y: 0, z: 0 };
    const right = { x: 0, y: 0, z: 0 };
    const up = { x: 0, y: 0, z: 0 };

    const angles = ent.client ? ent.client.v_angle : ent.angles; // Use v_angle for client view
    const vectors = angleVectors(angles || { x: 0, y: 0, z: 0 }); // Fallback

    // offset { 8, 8, -4 }

    const offset = { x: 8, y: 8, z: -4 };

    const start = {
        x: ent.origin.x + ent.viewheight * 0 + vectors.forward.x * offset.x + vectors.right.x * offset.y + vectors.up.x * offset.z,
        y: ent.origin.y + ent.viewheight * 0 + vectors.forward.y * offset.x + vectors.right.y * offset.y + vectors.up.y * offset.z,
        z: ent.origin.z + ent.viewheight * 1 + vectors.forward.z * offset.x + vectors.right.z * offset.y + vectors.up.z * offset.z
    };

    game.multicast(start, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.CHAINFIST_SMOKE, start);
}


export function fireChainfist(game: GameExports, player: Entity, inventory: PlayerInventory, weaponState: WeaponState, start: Vec3, forward: Vec3) {

    let damage = 7;
    if (game.deathmatch) damage = 15;
    if (player.client && player.client.quad_time && player.client.quad_time > game.time) {
        damage *= 4;
    }

    const hit = firePlayerMelee(game, player, start, forward, CHAINFIST_REACH, damage, 100, DamageMod.CHAINFIST);

    if (hit) {
         // Sound?
    }

    applyKick(player, -0.5, 0, 0);
}

export function Weapon_ChainFist(player: Entity, sys: EntitySystem) {
    const game = sys.game as GameExports; // helper

    const pause_frames: number[] = [];

    // In our fire callback:
    const fireCallback = (ent: Entity) => {
        const angles = ent.client ? ent.client.v_angle : ent.angles;
        const vectors = angleVectors(angles || { x: 0, y: 0, z: 0 });
        const forward = vectors.forward;
        const start = {
            x: ent.origin.x,
            y: ent.origin.y,
            z: ent.origin.z + (ent.viewheight || 0)
        };

        // Mocking inventory/weaponstate for now or passing dummy
        const inventory = ent.client ? ent.client.inventory : { ammo: { counts: [] } } as any;
        const weaponState = {} as any;

        fireChainfist(game, ent, inventory, weaponState, start, forward);

        // Handle specific Chainfist frame logic
        if (ent.client) {
            const client = ent.client;
            // buttons check
             const BUTTON_ATTACK = 1;
             const buttons = client.buttons;

             if (buttons & BUTTON_ATTACK) {
                 if (client.gun_frame === 12) client.gun_frame = 14;
                 else if (client.gun_frame === 22) client.gun_frame = 24;
                 else if (client.gun_frame >= 32) client.gun_frame = 7;
             } else {
                 // Release
                 if (client.gun_frame === 13 || client.gun_frame === 23 || client.gun_frame >= 32) {
                     client.gun_frame = 33; // End fire loop, go to idle?
                 }
             }
        }
    };

    Weapon_Repeating(
        player,
        4,
        32,
        57,
        60,
        pause_frames,
        fireCallback,
        sys
    );

    // Smoke logic
    if (player.client) {
        const gunframe = player.client.gun_frame;

        if ((gunframe === 42 || gunframe === 51) && Math.random() < 0.125) {
             if (Math.random() < 0.4) {
                 chainfistSmoke(game, player);
             }
        }
    }
}
