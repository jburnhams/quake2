// =================================================================
// Quake II - Blaster Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Generic } from './animation.js';
import { fireBlaster } from './firing.js';
import {
    FRAME_BLASTER_ACTIVATE_LAST,
    FRAME_BLASTER_FIRE_LAST,
    FRAME_BLASTER_IDLE_LAST,
    FRAME_BLASTER_DEACTIVATE_LAST
} from './frames.js';

const BLASTER_PAUSE_FRAMES = [19, 32];
const BLASTER_FIRE_FRAMES = [5];

export function blasterThink(player: Entity, sys: EntitySystem) {
    Weapon_Generic(
        player,
        FRAME_BLASTER_ACTIVATE_LAST,
        FRAME_BLASTER_FIRE_LAST,
        FRAME_BLASTER_IDLE_LAST,
        FRAME_BLASTER_DEACTIVATE_LAST,
        BLASTER_PAUSE_FRAMES,
        BLASTER_FIRE_FRAMES,
        (ent) => fireBlaster(sys.game, ent),
        sys
    );
}
