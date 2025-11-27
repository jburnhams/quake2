import { CGameImport } from '../types.js';
import { PlayerState, angleVectors, dotVec3, normalizeVec3 } from '@quake2ts/shared';

const damagePics = new Map<string, unknown>();

const DAMAGE_INDICATOR_NAMES = [
    'd_left', 'd_right', 'd_up', 'd_down'
];

export const Init_Damage = (cgi: CGameImport) => {
    for (const name of DAMAGE_INDICATOR_NAMES) {
        try {
            const pic = cgi.Draw_RegisterPic(`pics/${name}.pcx`);
            damagePics.set(name, pic);
        } catch (e) {
            cgi.Com_Print(`Failed to load HUD image: pics/${name}.pcx\n`);
        }
    }
};

export const Draw_Damage = (cgi: CGameImport, ps: PlayerState, width: number, height: number) => {
    // Basic placeholder check, ps structure needs damageIndicators support properly added
    // if using new PlayerState from shared. Assuming it matches for now.
    // If not, we need to add damage tracking to client/cgame state from events.
    if (!ps.damage_yaw && !ps.damage_pitch && !ps.damage_alpha) {
        // The original Q2 uses view angles and damage direction to pick quadrant.
        // It's event based usually. For now keeping structure but relying on
        // whatever ps has. Rerelease likely has fields or events.
        return;
    }

    // TODO: Implement damage indicator logic based on damage events or state
    // The previous implementation assumed a `damageIndicators` array which might not exist on PlayerState.
    // We will revisit this when implementing the damage event handling.
};
