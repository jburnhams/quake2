import { PlayerState } from '@quake2ts/shared';
import { Renderer } from '@quake2ts/shared/dist/cgame/interfaces';

export const Draw_Blends = (renderer: Renderer, ps: PlayerState) => {
    if (!ps.blend) return;

    const [r, g, b, a] = ps.blend;

    if (a > 0) {
        renderer.drawfillRect(0, 0, renderer.width, renderer.height, [r, g, b, a]);
    }
};
