import { CGameImport } from '../types.js';

export const Draw_Number = (cgi: CGameImport, x: number, y: number, value: number, pics: readonly unknown[], width: number, color?: [number, number, number, number]) => {
    const s = Math.abs(value).toString();
    for (let i = 0; i < s.length; i++) {
        const digit = parseInt(s[i]);
        const pic = pics[digit];
        if (pic) {
             if (color) {
                // cgi expects color as Vec3 (x,y,z) and alpha separate.
                // Assuming color is [r, g, b, a]
                cgi.SCR_DrawColorPic(x + i * width, y, pic, { x: color[0], y: color[1], z: color[2] }, color[3]);
            } else {
                cgi.SCR_DrawPic(x + i * width, y, pic);
            }
        }
    }
};
