// =================================================================
// Quake II - Machinegun Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Generic } from './animation.js';
import { fireMachinegun } from './firing.js';
import {
    FRAME_MACHINEGUN_ACTIVATE_LAST,
    FRAME_MACHINEGUN_FIRE_LAST,
    FRAME_MACHINEGUN_IDLE_LAST,
    FRAME_MACHINEGUN_DEACTIVATE_LAST
} from './frames.js';

const MACHINEGUN_PAUSE_FRAMES = [23, 45];
const MACHINEGUN_FIRE_FRAMES = [4, 5, 30, 31];

export function machinegunThink(player: Entity, sys: EntitySystem) {
    Weapon_Generic(
        player,
        FRAME_MACHINEGUN_ACTIVATE_LAST,
        FRAME_MACHINEGUN_FIRE_LAST,
        FRAME_MACHINEGUN_IDLE_LAST,
        FRAME_MACHINEGUN_DEACTIVATE_LAST,
        MACHINEGUN_PAUSE_FRAMES,
        MACHINEGUN_FIRE_FRAMES,
        (ent) => fireMachinegun(sys.game, ent),
        sys
    );
}
