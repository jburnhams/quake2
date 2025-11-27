import { PakArchive, Pic, Renderer } from '@quake2ts/engine';
import { PlayerState } from '@quake2ts/shared';
import { iconPics } from './icons.js'; // Reuse loaded icons

export const Draw_Pickup = (renderer: Renderer, ps: PlayerState) => {
    if (!ps.pickupIcon) return;

    const icon = iconPics.get(ps.pickupIcon);
    if (icon) {
        const x = renderer.width - icon.width - 10;
        const y = renderer.height - icon.height - 10;
        renderer.drawPic(x, y, icon);
    }
};
