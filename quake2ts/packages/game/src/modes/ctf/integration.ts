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

    // We need to find the flag entity that this player is carrying
    // Iterating all entities to find the flag owned by player

    // Note: This could be slow if we have many entities.
    // Optimization: Store reference to carried flag on player entity?
    // Or just iterate, since flags are few (usually 2).

    // We can also check inventory if they have the key item.
    const hasRedFlag = hasKey(player.client.inventory, KeyId.RedFlag);
    const hasBlueFlag = hasKey(player.client.inventory, KeyId.BlueFlag);

    if (!hasRedFlag && !hasBlueFlag) return;

    // Find the flag entity
    sys.forEachEntity((ent) => {
        const flag = ent as FlagEntity;
        if ((flag.classname === 'item_flag_team1' || flag.classname === 'item_flag_team2') && flag.owner === player) {
            // Drop it
            dropFlag(flag, player.origin, sys.game, sys);

            // Remove key from inventory
            player.client!.inventory.keys.delete(KeyId.RedFlag);
            player.client!.inventory.keys.delete(KeyId.BlueFlag);
        }
    });
}
