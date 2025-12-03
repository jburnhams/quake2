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

// Corrected pause frames based on C source and unreachable frames analysis
// Source: p_weapon.cpp:1240 (pause_frames[] = {34, 51, 59, 0})
// However, IDLE_LAST is 36, so 51 and 59 are unreachable.
// We keep 34.
const GRENADELAUNCHER_PAUSE_FRAMES = [34];
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
