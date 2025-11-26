import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { getWeaponState } from './state.js';
import { WeaponId } from '../../inventory/playerInventory.js';
import { BUTTON_ATTACK } from '../../buttons.js';

export function chaingunThink(player: Entity, sys: EntitySystem) {
    if (!player.client) {
        return;
    }

    const weaponState = getWeaponState(player.client.weaponStates, WeaponId.Chaingun);

    // If the player is not firing, and the spinupCount is not 0, then the player has just released the fire button.
    if (!(player.client.buttons & BUTTON_ATTACK) && weaponState.spinupCount && weaponState.spinupCount > 0) {
        // Play spin-down sound
        sys.sound(player, 0, 'weapons/chngnd1a.wav', 1, 0, 0);
        weaponState.spinupCount = 0;
    }
}
