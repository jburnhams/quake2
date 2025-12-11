import { Entity } from '../../entities/entity.js';
import { FlagEntity, FlagState, setFlagState } from './state.js';
import { EntitySystem } from '../../entities/system.js';
import { GameExports } from '../../index.js';

export function handleFlagPickup(
    flag: FlagEntity,
    player: Entity,
    game: GameExports,
    context: EntitySystem
): boolean {
    if (!player.client) return false;

    const playerTeam = (player.client as any).team || 'red';

    const sameTeam = flag.flagTeam === playerTeam;

    if (sameTeam) {
        if (flag.flagState === FlagState.AT_BASE) {
            return false; // Can't pickup own flag at base
        }
        if (flag.flagState === FlagState.DROPPED) {
            // Return to base
             game.sound?.(player, 0, 'ctf/flagret.wav', 1, 1, 0);
             game.centerprintf?.(player, `You returned the ${flag.flagTeam} flag!`);

             setFlagState(flag, FlagState.AT_BASE, context);
             flag.origin = { ...flag.baseOrigin };
             return true;
        }
    } else {
        // Enemy flag
        // Pickup
         game.sound?.(player, 0, 'ctf/flagpk.wav', 1, 1, 0);
         game.centerprintf?.(player, `You got the ${flag.flagTeam} flag!`);

         setFlagState(flag, FlagState.CARRIED, context);
         flag.owner = player;

         return true;
    }

    return false;
}
