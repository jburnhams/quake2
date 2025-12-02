// =================================================================
// Quake II - BFG10K Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Generic } from './animation.js';
import { fireBFG } from './firing.js';
import {
    FRAME_BFG_ACTIVATE_LAST,
    FRAME_BFG_FIRE_LAST,
    FRAME_BFG_IDLE_LAST,
    FRAME_BFG_DEACTIVATE_LAST
} from './frames.js';

const BFG_PAUSE_FRAMES = [39, 45, 50, 54];
const BFG_FIRE_FRAMES = [9, 22];

export function bfgThink(player: Entity, sys: EntitySystem) {
    Weapon_Generic(
        player,
        FRAME_BFG_ACTIVATE_LAST,
        FRAME_BFG_FIRE_LAST,
        FRAME_BFG_IDLE_LAST,
        FRAME_BFG_DEACTIVATE_LAST,
        BFG_PAUSE_FRAMES,
        BFG_FIRE_FRAMES,
        (ent) => fireBFG(sys.game, ent),
        sys
    );
}
