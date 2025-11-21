import { Pic, Renderer } from '@quake2ts/engine';

export const Draw_Number = (renderer: Renderer, x: number, y: number, value: number, pics: readonly Pic[], width: number) => {
    const s = Math.abs(value).toString();
    for (let i = 0; i < s.length; i++) {
        const digit = parseInt(s[i]);
        const pic = pics[digit];
        if (pic) {
            renderer.drawPic(x + i * width, y, pic);
        }
    }
};
