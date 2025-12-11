// =================================================================
// Quake II - CTF Flag Drop Logic
// =================================================================

import { Entity, Solid } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { FlagEntity, FlagState, setFlagState } from './state.js';
import { GameExports } from '../../index.js';

export function dropFlag(
    flag: FlagEntity,
    origin: [number, number, number],
    game: GameExports,
    context: EntitySystem
): void {
    if (flag.flagState !== FlagState.CARRIED) {
        return;
    }

    setFlagState(flag, FlagState.DROPPED, context);

    // Set position to where it was dropped (e.g. player origin)
    // We might need to adjust Z slightly up so it doesn't clip floor
    flag.origin = [origin[0], origin[1], origin[2] + 24]; // Approx waist height? Or +0?
    // Q2 usually tosses it a bit.

    flag.owner = undefined;
    flag.solid = Solid.Trigger;

    // Restore model visibility
    flag.model = flag.flagTeam === 'red' ? 'players/male/flag1.md2' : 'players/male/flag2.md2';

    // Set auto-return timer (30 seconds)
    // We use nextthink for this.
    // Ensure we have a think function set up to handle the return.
    flag.nextthink = (context.entities?.timeSeconds || game.time) + 30.0;

    // Play sound
    // game.sound?.(flag, ...);

    game.multicast?.(flag.origin, {
         // Some effect?
    });

    game.centerprintf?.(flag, `The ${flag.flagTeam} flag was dropped!`);
    // game.bprint(`The ${flag.flagTeam} flag was dropped!`);

    // Ensure the flag has a think function to handle return
    flag.think = (selfEntity, ctx) => flagThink(selfEntity, ctx, game);
}

export function flagThink(self: Entity, context: EntitySystem, game: GameExports): void {
    const flag = self as FlagEntity;

    if (flag.flagState === FlagState.DROPPED) {
        // Timeout reached, return flag
         game.sound?.(flag, 0, 'ctf/flagret.wav', 1, 1, 0); // Sound from global or flag pos
         game.centerprintf?.(flag, `The ${flag.flagTeam} flag returned to base!`);

         setFlagState(flag, FlagState.AT_BASE, context);
         flag.origin = [...flag.baseOrigin];
         flag.solid = Solid.Trigger; // Make sure it's valid at base
         flag.nextthink = -1; // Stop thinking until picked up/dropped again
    }
}
