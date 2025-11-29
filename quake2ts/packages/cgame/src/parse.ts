import type { CGameImport } from './types.js';
import { ConfigStringIndex, MAX_MODELS, MAX_SOUNDS, MAX_IMAGES } from '@quake2ts/shared';

/**
 * Parses a config string update and precaches assets if necessary.
 * Reference: rerelease/cg_main.cpp CL_ParseConfigString
 */
export function CG_ParseConfigString(cgi: CGameImport, i: number, s: string): void {
    if (i >= ConfigStringIndex.Models && i < ConfigStringIndex.Models + MAX_MODELS) {
        cgi.RegisterModel(s);
    } else if (i >= ConfigStringIndex.Sounds && i < ConfigStringIndex.Sounds + MAX_SOUNDS) {
        cgi.RegisterSound(s);
    } else if (i >= ConfigStringIndex.Images && i < ConfigStringIndex.Images + MAX_IMAGES) {
        cgi.Draw_RegisterPic(s);
    }
}
