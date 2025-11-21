import { PakArchive, Pic, Renderer } from '@quake2ts/engine';

let crosshairPic: Pic | null = null;

export const Init_Crosshair = async (renderer: Renderer, pak: PakArchive) => {
    try {
        const data = pak.readFile('pics/crosshair.pcx');
        crosshairPic = await renderer.registerPic('crosshair', data.buffer as ArrayBuffer);
    } catch (e) {
        console.error('Failed to load crosshair image: pics/crosshair.pcx');
    }
}

export const Draw_Crosshair = (renderer: Renderer, width: number, height: number) => {
    if (crosshairPic) {
        const x = (width - crosshairPic.width) / 2;
        const y = (height - crosshairPic.height) / 2;
        renderer.drawPic(x, y, crosshairPic);
    }
};
