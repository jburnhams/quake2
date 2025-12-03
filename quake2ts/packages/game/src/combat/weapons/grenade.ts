// =================================================================
// Quake II - Hand Grenade Weapon
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { GameExports } from '../../index.js';
import { WeaponState } from './state.js';
import { WeaponId } from '../../inventory/playerInventory.js';
import { AmmoType } from '../../inventory/ammo.js';
import {
    angleVectors, ServerCommand, TempEntity,
    MZ_GRENADE
} from '@quake2ts/shared';
import { T_RadiusDamage } from '../damage.js';
import { DamageFlags } from '../damageFlags.js';
import { DamageMod } from '../damageMods.js';
import { createGrenade } from '../../entities/projectiles.js';
import { MulticastType } from '../../imports.js';
import { P_ProjectSource } from './projectSource.js';
import { Throw_Generic } from './animation.js';
import { applyKick } from './common.js';
import {
    FRAME_GRENADE_IDLE_FIRST, FRAME_GRENADE_IDLE_LAST, FRAME_GRENADE_THROW_FIRST,
    FRAME_GRENADE_THROW_LAST, FRAME_GRENADE_PRIME_SOUND, FRAME_GRENADE_THROW_HOLD,
    FRAME_GRENADE_THROW_FIRE
} from './frames.js';
import {
    FRAME_crattak1, FRAME_crattak3,
    FRAME_wave08, FRAME_wave01,
    ANIM_ATTACK
} from '../../entities/player_anim.js';

export function grenadeThink(player: Entity, sys: EntitySystem) {
    // Mock GameExports context for P_ProjectSource and other functions
    const game = {
        trace: (start: any, mins: any, maxs: any, end: any, passent: any, mask: any) => sys.trace(start, mins, maxs, end, passent, mask),
        multicast: (origin: any, type: any, event: any, ...args: any[]) => {
            if (sys.engine.multicast) sys.engine.multicast(origin, type, event, ...args);
        },
        time: sys.timeSeconds,
        entities: sys,
        deathmatch: sys.deathmatch,
        random: (sys as any).random // Access private random or use imported one if available
    } as unknown as GameExports;

    Throw_Generic(
        player,
        FRAME_GRENADE_THROW_LAST,
        FRAME_GRENADE_IDLE_LAST,
        FRAME_GRENADE_THROW_FIRST,
        FRAME_GRENADE_THROW_LAST,
        FRAME_GRENADE_PRIME_SOUND,
        FRAME_GRENADE_THROW_HOLD,
        FRAME_GRENADE_THROW_FIRE,
        (ent: Entity, held: boolean) => {
            // FIRE callback
            if (ent.client) {
                ent.client.inventory.ammo.counts[AmmoType.Grenades]--;
            }

            if (held) {
                const dmg = 120;
                T_RadiusDamage([ent] as any, ent as any, ent as any, dmg, ent as any, 120, DamageFlags.NONE, DamageMod.GRENADE, game.time, {}, game.multicast);
                game.multicast(ent.origin, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.GRENADE_EXPLOSION, ent.origin);
            } else {
                let heldTime = 0;
                if (ent.client && ent.client.grenade_time) {
                    const timeLeft = ent.client.grenade_time - game.time;
                    heldTime = 3.0 - timeLeft;
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

                const { point, dir } = P_ProjectSource(game, ent, { x: 2, y: 0, z: -14 }, forward, right, up);

                createGrenade(game.entities, ent, point, dir, 120, speed, timer);

                if (ent.client && !ent.deadflag) {
                    if (ent.client.pm_flags & 2) { // PMF_DUCKED
                        ent.frame = FRAME_crattak1 - 1;
                        ent.client.anim_end = FRAME_crattak3;
                    } else {
                        ent.frame = FRAME_wave08;
                        ent.client.anim_end = FRAME_wave01;
                    }
                    ent.client.anim_priority = ANIM_ATTACK;
                }
            }
        },
        sys
    );
}
