import { PakArchive, Pic, Renderer } from '@quake2ts/engine';

let crosshairPic: Pic | null = null;
let crosshairIndex = 0; // Default to ch1

const CROSSHAIR_NAMES = ['ch1', 'ch2', 'ch3'];
const crosshairPics: (Pic | null)[] = [null, null, null];

export const Init_Crosshair = async (renderer: Renderer, pak: PakArchive) => {
    // Load default crosshair for now (pics/ch1.pcx usually in Q2, but sometimes just pics/crosshair.pcx mod-dependent)
    // Rerelease uses ch1.pcx, ch2.pcx, ch3.pcx

    for (let i = 0; i < CROSSHAIR_NAMES.length; i++) {
        const name = CROSSHAIR_NAMES[i];
        try {
            // Try loading from pics/chX.pcx
            // Note: In baseq2 pak0.pak, there might not be ch1/2/3.
            // There is usually 'pics/misc/crosshair.pcx' or similar in mods.
            // Rerelease might have specific ones.
            // Let's try loading 'ch1' as 'pics/ch1.pcx' and fallback/others.
            // For this task, we will try to load 'pics/ch1.pcx'.

            // Wait, standard Q2 PAK0.PAK has 'pics/ch1.pcx', 'pics/ch2.pcx', 'pics/ch3.pcx'.
            const data = pak.readFile(`pics/${name}.pcx`);
            crosshairPics[i] = await renderer.registerPic(name, data.buffer as ArrayBuffer);
        } catch (e) {
            // Fallback: try loading 'pics/crosshair.pcx' for the first one if ch1 fails?
            if (i === 0) {
                 try {
                    const data = pak.readFile('pics/crosshair.pcx');
                    crosshairPics[i] = await renderer.registerPic('crosshair', data.buffer as ArrayBuffer);
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

export const Draw_Crosshair = (renderer: Renderer, width: number, height: number) => {
    // Check cvars for crosshair enablement/style?
    // For now, just draw if loaded.

    if (crosshairPic) {
        const x = (width - crosshairPic.width) / 2;
        const y = (height - crosshairPic.height) / 2;
        renderer.drawPic(x, y, crosshairPic);
    }
};
