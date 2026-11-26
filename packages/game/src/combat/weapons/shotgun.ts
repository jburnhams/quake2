// =================================================================
// Quake II - Shotgun Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Generic } from './animation.js';
import { fireShotgun } from './firing.js';
import {
    FRAME_SHOTGUN_ACTIVATE_LAST,
    FRAME_SHOTGUN_FIRE_LAST,
    FRAME_SHOTGUN_IDLE_LAST,
    FRAME_SHOTGUN_DEACTIVATE_LAST
} from './frames.js';

const SHOTGUN_PAUSE_FRAMES = [22, 28, 34];
const SHOTGUN_FIRE_FRAMES = [8];

export function shotgunThink(player: Entity, sys: EntitySystem) {
    Weapon_Generic(
        player,
        FRAME_SHOTGUN_ACTIVATE_LAST,
        FRAME_SHOTGUN_FIRE_LAST,
        FRAME_SHOTGUN_IDLE_LAST,
        FRAME_SHOTGUN_DEACTIVATE_LAST,
        SHOTGUN_PAUSE_FRAMES,
        SHOTGUN_FIRE_FRAMES,
        (ent) => fireShotgun(sys.game, ent),
        sys
    );
}
