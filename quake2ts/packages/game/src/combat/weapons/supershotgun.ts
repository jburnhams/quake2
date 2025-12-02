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

const SSHOTGUN_PAUSE_FRAMES = [29, 42, 57];
const SSHOTGUN_FIRE_FRAMES = [22, 28];

export function superShotgunThink(player: Entity, sys: EntitySystem) {
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
