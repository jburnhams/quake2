import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { GameExports } from '../../index.js';
import { WeaponState } from './state.js';
import { PlayerInventory } from '../../inventory/playerInventory.js';
import { AmmoType } from '../../inventory/ammo.js';
import {
    Vec3, ServerCommand,
    MZ_ROCKET, angleVectors
} from '@quake2ts/shared';
import { MulticastType } from '../../imports.js';
import { applyKick } from './common.js';
import { createTrap } from '../../entities/projectiles.js';
import { Throw_Generic } from './animation.js';
import {
    FRAME_GRENADE_THROW_LAST, FRAME_GRENADE_IDLE_LAST,
    FRAME_GRENADE_THROW_FIRST, FRAME_GRENADE_PRIME_SOUND,
    FRAME_GRENADE_THROW_HOLD, FRAME_GRENADE_THROW_FIRE
} from './frames.js';

export function fireTrap(game: GameExports, player: Entity, inventory: PlayerInventory, weaponState: WeaponState, start: Vec3, forward: Vec3) {
    if (inventory.ammo.counts[AmmoType.Trap] < 1) {
        return;
    }

    inventory.ammo.counts[AmmoType.Trap]--;

    game.multicast(player.origin, MulticastType.Pvs, ServerCommand.muzzleflash, player.index, MZ_ROCKET);
    applyKick(player, -2, 0, 0);

    const damage = 200; // High damage
    const speed = 800;

    createTrap(game.entities, player, start, forward, damage, speed);
}

export function trapThink(player: Entity, sys: EntitySystem) {
    // Mock GameExports context for fire function
    const game = {
        trace: (start: any, mins: any, maxs: any, end: any, passent: any, mask: any) => sys.trace(start, mins, maxs, end, passent, mask),
        multicast: (origin: any, type: any, event: any, ...args: any[]) => {
            if (sys.engine.multicast) sys.engine.multicast(origin, type, event, ...args);
        },
        time: sys.timeSeconds,
        entities: sys,
        deathmatch: sys.deathmatch,
        random: (sys as any).random
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
            // Fire callback
            const angles = { ...ent.angles };
            angles.z = 0;
            const vectors = angleVectors(angles);
            const start = { ...ent.origin };
            start.z += ent.viewheight;

            if (ent.client)
                fireTrap(game, ent, ent.client.inventory, {} as any, start, vectors.forward);
        },
        sys
    );
}
