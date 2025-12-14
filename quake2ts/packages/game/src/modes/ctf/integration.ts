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
    let foundFlag: FlagEntity | null = null;
    sys.forEachEntity((ent) => {
        const flag = ent as FlagEntity;
        if ((flag.classname === 'item_flag_team1' || flag.classname === 'item_flag_team2') && flag.owner === player) {
            foundFlag = flag;
        }
    });

    if (foundFlag) {
        // We pass null for game, as dropFlag now relies on EntitySystem mostly
        dropFlag(foundFlag, player.origin, null, sys);

        // Remove key from inventory
        player.client!.inventory.keys.delete(KeyId.RedFlag);
        player.client!.inventory.keys.delete(KeyId.BlueFlag);
    }
}
