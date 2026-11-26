// =================================================================
// Quake II - Rocket Launcher Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Generic } from './animation.js';
import { fireRocket } from './firing.js';
import {
    FRAME_ROCKET_ACTIVATE_LAST,
    FRAME_ROCKET_FIRE_LAST,
    FRAME_ROCKET_IDLE_LAST,
    FRAME_ROCKET_DEACTIVATE_LAST
} from './frames.js';

const ROCKET_PAUSE_FRAMES = [25, 33];
const ROCKET_FIRE_FRAMES = [4];

export function rocketLauncherThink(player: Entity, sys: EntitySystem) {
    Weapon_Generic(
        player,
        FRAME_ROCKET_ACTIVATE_LAST,
        FRAME_ROCKET_FIRE_LAST,
        FRAME_ROCKET_IDLE_LAST,
        FRAME_ROCKET_DEACTIVATE_LAST,
        ROCKET_PAUSE_FRAMES,
        ROCKET_FIRE_FRAMES,
        (ent) => fireRocket(sys.game, ent),
        sys
    );
}
