// =================================================================
// Quake II - Railgun Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Generic } from './animation.js';
import { fireRailgunShot } from './firing.js';
import {
    FRAME_RAILGUN_ACTIVATE_LAST,
    FRAME_RAILGUN_FIRE_LAST,
    FRAME_RAILGUN_IDLE_LAST,
    FRAME_RAILGUN_DEACTIVATE_LAST
} from './frames.js';

const RAILGUN_PAUSE_FRAMES = [56];
const RAILGUN_FIRE_FRAMES = [4];

export function railgunThink(player: Entity, sys: EntitySystem) {
    Weapon_Generic(
        player,
        FRAME_RAILGUN_ACTIVATE_LAST,
        FRAME_RAILGUN_FIRE_LAST,
        FRAME_RAILGUN_IDLE_LAST,
        FRAME_RAILGUN_DEACTIVATE_LAST,
        RAILGUN_PAUSE_FRAMES,
        RAILGUN_FIRE_FRAMES,
        (ent) => fireRailgunShot(sys.game, ent),
        sys
    );
}
