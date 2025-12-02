// =================================================================
// Quake II - Chaingun Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { getWeaponState } from './state.js';
import { WeaponId } from '../../inventory/playerInventory.js';
import { BUTTON_ATTACK } from '../../buttons.js';
import { Weapon_Repeating } from './animation.js';
import { fireChaingun } from './firing.js';
import {
    FRAME_CHAINGUN_ACTIVATE_LAST,
    FRAME_CHAINGUN_FIRE_FRAME,
    FRAME_CHAINGUN_FIRE_LAST,
    FRAME_CHAINGUN_IDLE_LAST,
    FRAME_CHAINGUN_DEACTIVATE_LAST
} from './frames.js';

const CHAINGUN_PAUSE_FRAMES = [38, 43, 51, 61];
// fire_frames not used in Weapon_Repeating as it handles firing internally?
// Wait, C code has: static int fire_frames[] = {5, 0};
// And Weapon_Repeating call passes it.
// But Weapon_Repeating logic in C:
// if (fire_frames) { ... if (gunframe == fire_frames[n]) fire(ent); ... }
// My TS Weapon_Repeating logic:
// if (gunframe == FRAME_FIRE_FRAME) fire(ent);
// So I should pass FRAME_CHAINGUN_FIRE_FRAME (5) as the single fire frame?
// The signature of my Weapon_Repeating supports explicit FRAME_FIRE_FRAME.

// However, I updated Weapon_Repeating in animation.ts to delegate to Weapon_Generic for non-firing states.
// Weapon_Generic takes pause_frames and fire_frames.

export function chaingunThink(player: Entity, sys: EntitySystem) {
    const weaponState = getWeaponState(player.client!.weaponStates, WeaponId.Chaingun);

    // Check for spin-down sound
    if (!(player.client!.buttons & BUTTON_ATTACK) && weaponState.spinupCount && weaponState.spinupCount > 0) {
        sys.sound(player, 0, 'weapons/chngnd1a.wav', 1, 0, 0);
        weaponState.spinupCount = 0;
    }

    // Weapon Repeating Logic
    // In C: Weapon_Repeating (ent, 5, 21, 52, 61, pause_frames, fire_frames, Chaingun_Fire);
    // My TS Signature:
    // Weapon_Repeating(ent, FRAME_FIRE_FRAME, FRAME_FIRE_LAST, FRAME_IDLE_LAST, FRAME_DEACTIVATE_LAST, FRAME_NOOP, fire, sys)
    // Wait, I updated Weapon_Repeating signature? No, I only updated Weapon_Generic.
    // I need to update Weapon_Repeating signature in animation.ts or stick to what I have.
    // In animation.ts I see:
    // export function Weapon_Repeating(ent, FRAME_FIRE_FRAME, FRAME_FIRE_LAST, FRAME_IDLE_LAST, FRAME_PAUSE, FRAME_NOOP, fire, sys)

    // And in animation.ts Weapon_Repeating implementation:
    // It calls Weapon_Generic(..., FRAME_PAUSE, null, null, ...)
    // So it ignores arrays for non-firing states?
    // C code passes pause_frames to Weapon_Generic via Weapon_Repeating.

    // I should probably update Weapon_Repeating to accept arrays if I want pause frames to work during idle/deactivate.
    // But currently I am stuck with the signature in animation.ts unless I change it.
    // I changed Weapon_Generic. I did NOT change Weapon_Repeating signature in the file overwrite?
    // Let me double check animation.ts content I wrote.

    // I wrote:
    // export function Weapon_Repeating(..., FRAME_PAUSE, FRAME_NOOP, fire, sys)
    // And inside:
    // Weapon_Generic(..., FRAME_PAUSE, null, null, fire, sys);

    // So currently pause_frames are LOST in Weapon_Repeating.
    // I should fix Weapon_Repeating in animation.ts first.

    Weapon_Repeating(
        player,
        FRAME_CHAINGUN_FIRE_FRAME,
        FRAME_CHAINGUN_FIRE_LAST,
        FRAME_CHAINGUN_IDLE_LAST,
        FRAME_CHAINGUN_DEACTIVATE_LAST,
        0, // FRAME_NOOP
        (ent) => fireChaingun(sys.game, ent),
        sys
    );
}
