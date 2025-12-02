// =================================================================
// Quake II - Grenade Launcher Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Generic } from './animation.js';
import { fireGrenadeLauncher } from './firing.js';
import {
    FRAME_GRENADELAUNCHER_ACTIVATE_LAST,
    FRAME_GRENADELAUNCHER_FIRE_LAST,
    FRAME_GRENADELAUNCHER_IDLE_LAST,
    FRAME_GRENADELAUNCHER_DEACTIVATE_LAST
} from './frames.js';

const GRENADELAUNCHER_PAUSE_FRAMES = [34, 51, 59];
const GRENADELAUNCHER_FIRE_FRAMES = [6];

export function grenadeLauncherThink(player: Entity, sys: EntitySystem) {
    Weapon_Generic(
        player,
        FRAME_GRENADELAUNCHER_ACTIVATE_LAST,
        FRAME_GRENADELAUNCHER_FIRE_LAST,
        FRAME_GRENADELAUNCHER_IDLE_LAST,
        FRAME_GRENADELAUNCHER_DEACTIVATE_LAST,
        GRENADELAUNCHER_PAUSE_FRAMES,
        GRENADELAUNCHER_FIRE_FRAMES,
        (ent) => fireGrenadeLauncher(sys.game, ent),
        sys
    );
}
