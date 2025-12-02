// =================================================================
// Quake II - Blaster Weapon Logic
// =================================================================

import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { Weapon_Generic } from './animation.js';
import { fireBlaster } from './firing.js';

// Blaster frames
// Source: p_weapon.cpp:1342-1393
// FRAME_ACTIVATE_LAST = 4
// FRAME_FIRE_LAST = 8
// FRAME_IDLE_LAST = 52
// FRAME_DEACTIVATE_LAST = 55
// pause_frames = {19, 32}
// fire_frames = {5}

const BLASTER_ACTIVATE_LAST = 4;
const BLASTER_FIRE_LAST = 8;
const BLASTER_IDLE_LAST = 52;
const BLASTER_DEACTIVATE_LAST = 55;
const BLASTER_PAUSE_FRAMES = [19, 32];
const BLASTER_FIRE_FRAMES = [5];

export function blasterThink(player: Entity, sys: EntitySystem) {
    Weapon_Generic(
        player,
        BLASTER_ACTIVATE_LAST,
        BLASTER_FIRE_LAST,
        BLASTER_IDLE_LAST,
        BLASTER_DEACTIVATE_LAST,
        BLASTER_PAUSE_FRAMES,
        BLASTER_FIRE_FRAMES,
        (ent) => fireBlaster(sys.game, ent),
        sys
    );
}
