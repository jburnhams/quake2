// =================================================================
// Quake II - HyperBlaster Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Repeating } from './animation.js';
import { fireHyperBlaster } from './firing.js';
import {
    FRAME_HYPERBLASTER_ACTIVATE_LAST,
    FRAME_HYPERBLASTER_FIRE_FRAME,
    FRAME_HYPERBLASTER_FIRE_LAST,
    FRAME_HYPERBLASTER_IDLE_LAST,
    FRAME_HYPERBLASTER_DEACTIVATE_LAST
} from './frames.js';

export function hyperBlasterThink(player: Entity, sys: EntitySystem) {
    Weapon_Repeating(
        player,
        FRAME_HYPERBLASTER_FIRE_FRAME,
        FRAME_HYPERBLASTER_FIRE_LAST,
        FRAME_HYPERBLASTER_IDLE_LAST,
        FRAME_HYPERBLASTER_DEACTIVATE_LAST,
        0, // FRAME_NOOP
        (ent) => fireHyperBlaster(sys.game, ent),
        sys
    );
}
