import { ViewEffects } from '@quake2ts/cgame';
import { Vec3 } from '@quake2ts/shared';

// Implements P_AddWeaponKick from rerelease/p_weapon.cpp
export function applyWeaponKick(view: ViewEffects, quad: boolean): void {
    let kickPitch = -2;
    if (quad) {
        kickPitch *= 4;
    }

    // Origin kick: "pushback"
    // P_AddWeaponKick sets kick_origin.
    const kickOrigin: Vec3 = { x: -2, y: 0, z: 0 };

    view.addKick({
        pitch: kickPitch,
        roll: 0,
        durationMs: 200, // 200ms duration
        origin: kickOrigin
    });
}
