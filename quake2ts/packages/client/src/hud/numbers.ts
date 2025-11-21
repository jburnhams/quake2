import { Draw_Pic } from '../../engine/src/render/draw.js';

// The font used for the HUD numbers is composed of individual images
// for each digit. We'll need to register these pics and then use them
// to draw the numbers.

export const Draw_Number = (x: number, y: number, value: number, pics: readonly number[], width: number) => {
    const s = Math.abs(value).toString();
    for (let i = 0; i < s.length; i++) {
        const digit = parseInt(s[i]);
        const pic = pics[digit];
        Draw_Pic(x + i * width, y, pic);
    }
};
