// =================================================================
// Quake II - Super Shotgun Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Generic } from './animation.js';
import { fireSuperShotgun } from './firing.js';
import {
    FRAME_SSHOTGUN_ACTIVATE_LAST,
    FRAME_SSHOTGUN_FIRE_LAST,
    FRAME_SSHOTGUN_IDLE_LAST,
    FRAME_SSHOTGUN_DEACTIVATE_LAST
} from './frames.js';
import { getWeaponState } from './state.js';
import { WeaponId } from '../../inventory/playerInventory.js';

const SSHOTGUN_PAUSE_FRAMES = [29, 42, 57];
const SSHOTGUN_FIRE_FRAMES = [22, 28];
const BUTTON_ATTACK2 = 32;

export function superShotgunThink(player: Entity, sys: EntitySystem) {
    const client = player.client!;
    const weaponState = getWeaponState(client.weaponStates, WeaponId.SuperShotgun);

    // Alt-Fire: Precision Mode
    // Check if Alt-Fire button is held
    // Store mode in weaponState? Or just pass flag to fireSuperShotgun?
    // Weapon_Generic takes a fire callback. We can wrap it.

    // Original task:
    // - Tighter pellet spread
    // - Reduced damage per pellet
    // - Longer range effectiveness

    // We can use a property on weaponState to toggle mode if we want persistent mode,
    // or just check button state in the fire callback.
    // However, `fireSuperShotgun` in `firing.ts` doesn't take extra args easily unless we modify it or the callback.
    // Let's modify `fireSuperShotgun` to check button state on the player entity directly, similar to other alt-fires.

    // So here we just pass the standard logic.

    Weapon_Generic(
        player,
        FRAME_SSHOTGUN_ACTIVATE_LAST,
        FRAME_SSHOTGUN_FIRE_LAST,
        FRAME_SSHOTGUN_IDLE_LAST,
        FRAME_SSHOTGUN_DEACTIVATE_LAST,
        SSHOTGUN_PAUSE_FRAMES,
        SSHOTGUN_FIRE_FRAMES,
        (ent) => fireSuperShotgun(sys.game, ent),
        sys
    );
}
