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

    // TODO: Retrieve actual player team.
    // For now we assume a property 'team' on client or pers, or default to opposite for testing.
    // Since we don't have team system yet (Task 6.1.4), we will defer strict team checks
    // OR we can implement a basic interface here.

    // Hack: Infer team from model skin or something? No, that's unreliable.
    // Let's assume for now everyone is Red team for testing, unless configured otherwise.
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
             flag.origin = [...flag.baseOrigin];
             return true;
        }
    } else {
        // Enemy flag
        // Pickup
         game.sound?.(player, 0, 'ctf/flagpk.wav', 1, 1, 0);
         game.centerprintf?.(player, `You got the ${flag.flagTeam} flag!`);

         setFlagState(flag, FlagState.CARRIED, context);
         flag.owner = player;

         // Give flag item to player inventory
         // We need to know which item ID corresponds to this flag
         // flag.classname should be 'item_flag_team1' or 'item_flag_team2'

         // In original code, player gets the item.
         // We should call pickupFlag() here or rely on the caller doing it?
         // The caller (touch) usually handles inventory.
         return true;
    }

    return false;
}
