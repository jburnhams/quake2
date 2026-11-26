// =================================================================
// Quake II - CTF Flag Drop Logic
// =================================================================

import { Entity, Solid } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { FlagEntity, FlagState, setFlagState } from './state.js';
import { GameExports } from '../../index.js';
import { Vec3, ServerCommand } from '@quake2ts/shared';
import { MulticastType } from '../../imports.js';

export function dropFlag(
    flag: FlagEntity,
    origin: Vec3,
    game: GameExports | null,
    context: EntitySystem
): void {
    if (flag.flagState !== FlagState.CARRIED) {
        return;
    }

    setFlagState(flag, FlagState.DROPPED, context);

    // Set position to where it was dropped (e.g. player origin)
    flag.origin = { x: origin.x, y: origin.y, z: origin.z + 24 };

    flag.owner = null; // Correct type for Entity owner
    flag.solid = Solid.Trigger;

    // Restore model visibility
    flag.model = flag.flagTeam === 'red' ? 'players/male/flag1.md2' : 'players/male/flag2.md2';

    // Set auto-return timer (30 seconds)
    const time = context.timeSeconds;
    flag.nextthink = time + 30.0;

    // Play sound (using multicast for "event" sound if needed, or just entity sound)
    // context.sound?.(flag, ...);

    // Effect?
    // context.multicast?.(flag.origin, MulticastType.Pvs, ServerCommand.muzzleflash, ...);

    context.engine.centerprintf?.(flag, `The ${flag.flagTeam} flag was dropped!`);

    // Ensure the flag has a think function to handle return
    flag.think = (selfEntity, ctx) => flagThink(selfEntity, ctx);
}

export function flagThink(self: Entity, context: EntitySystem): void {
    const flag = self as FlagEntity;

    if (flag.flagState === FlagState.DROPPED) {
         // Return flag
         context.sound(flag, 0, 'ctf/flagret.wav', 1, 1, 0);
         context.engine.centerprintf?.(flag, `The ${flag.flagTeam} flag returned to base!`);

         setFlagState(flag, FlagState.AT_BASE, context);
         flag.origin = { ...flag.baseOrigin };
         flag.solid = Solid.Trigger;
         flag.nextthink = -1;
    }
}
