import { AssetManager, Pic, Renderer } from '@quake2ts/engine';

let crosshairPic: Pic | null = null;
let crosshairIndex = 0; // Default to ch1

const CROSSHAIR_NAMES = ['ch1', 'ch2', 'ch3'];
const crosshairPics: (Pic | null)[] = [null, null, null];

export const Init_Crosshair = async (renderer: Renderer, assets: AssetManager) => {
    for (let i = 0; i < CROSSHAIR_NAMES.length; i++) {
        const name = CROSSHAIR_NAMES[i];
        try {
            const texture = await assets.loadTexture(`pics/${name}.pcx`);
            crosshairPics[i] = renderer.registerTexture(name, texture);
        } catch (e) {
            if (i === 0) {
                 try {
                    const texture = await assets.loadTexture('pics/crosshair.pcx');
                    crosshairPics[i] = renderer.registerTexture('crosshair', texture);
                } catch (e2) {
                    console.error('Failed to load crosshair image');
                }
            }
        }
    }

    crosshairPic = crosshairPics[0];
}

export const Set_Crosshair = (index: number) => {
    if (index >= 0 && index < crosshairPics.length) {
        crosshairIndex = index;
        crosshairPic = crosshairPics[index];
    }
};

export const Cycle_Crosshair = () => {
    crosshairIndex = (crosshairIndex + 1) % CROSSHAIR_NAMES.length;
    crosshairPic = crosshairPics[crosshairIndex];
    if (!crosshairPic) {
        let found = false;
        for (let i = 0; i < CROSSHAIR_NAMES.length; i++) {
             const idx = (crosshairIndex + i) % CROSSHAIR_NAMES.length;
             if (crosshairPics[idx]) {
                 crosshairIndex = idx;
                 crosshairPic = crosshairPics[idx];
                 found = true;
                 break;
             }
        }
        if (!found) crosshairPic = null;
    }
    return crosshairIndex;
};

export const Draw_Crosshair = (renderer: Renderer, width: number, height: number) => {
    if (crosshairPic) {
        const x = (width - crosshairPic.width) / 2;
        const y = (height - crosshairPic.height) / 2;
        renderer.drawPic(x, y, crosshairPic);
    }
};
