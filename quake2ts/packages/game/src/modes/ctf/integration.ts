// =================================================================
// Quake II - CTF Integration
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { KeyId, hasKey } from '../../inventory/playerInventory.js';
import { dropFlag } from './drop.js';
import { FlagEntity } from './state.js';
import { GameExports } from '../../index.js';

export function checkPlayerFlagDrop(player: Entity, sys: EntitySystem) {
    if (!player.client) return;

    // We can also check inventory if they have the key item.
    const hasRedFlag = hasKey(player.client.inventory, KeyId.RedFlag);
    const hasBlueFlag = hasKey(player.client.inventory, KeyId.BlueFlag);

    if (!hasRedFlag && !hasBlueFlag) return;

    // Find the flag entity
    sys.forEachEntity((ent) => {
        const flag = ent as FlagEntity;
        if ((flag.classname === 'item_flag_team1' || flag.classname === 'item_flag_team2') && flag.owner === player) {
            // Drop it
            // Assuming sys.game is accessible or we need another way to get GameExports
            // Usually EntitySystem has a reference to game or we can pass it.
            // But EntitySystem definition doesn't strictly include 'game'.
            // However, in our index.ts we attach it: (entities as any)._game = gameExports;
            const game = (sys as any)._game as GameExports;
            if (game) {
                dropFlag(flag, player.origin, game, sys);

                // Remove key from inventory
                player.client!.inventory.keys.delete(KeyId.RedFlag);
                player.client!.inventory.keys.delete(KeyId.BlueFlag);
            }
        }
    });
}
