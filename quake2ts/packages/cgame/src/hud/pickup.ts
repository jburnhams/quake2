import { CGameImport } from '../types.js';
import { PlayerState } from '@quake2ts/shared';
import { iconPics } from './icons.js'; // Reuse loaded icons

export const Draw_Pickup = (cgi: CGameImport, ps: PlayerState, width: number, height: number) => {
    if (!ps.pickupIcon) return;

    const icon = iconPics.get(ps.pickupIcon);
    if (icon) {
        const size = cgi.Draw_GetPicSize(icon);
        const x = width - size.width - 10;
        const y = height - size.height - 10;
        cgi.SCR_DrawPic(x, y, icon);
    }
};
