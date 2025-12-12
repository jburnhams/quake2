import { CGameImport } from '../types.js';
import { PlayerState } from '@quake2ts/shared';

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
    // Check if we have damage to show
    // Use proper fields from PlayerState
    if ((!ps.damageAlpha || ps.damageAlpha <= 0) && (!ps.damageIndicators || ps.damageIndicators.length === 0)) {
        return;
    }

    // TODO: Implement damage indicator drawing using ps.damageIndicators
    // Original implementation relied on fields that are not in the current PlayerState.
    // For now we just compile.
};
