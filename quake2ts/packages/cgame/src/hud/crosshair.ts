import { CGameImport } from '../types.js';

let crosshairPic: unknown | null = null;
let crosshairIndex = 0; // Default to ch1
let crosshairColor: [number, number, number, number] = [1, 1, 1, 1]; // Default white
let crosshairEnabled = true;

const CROSSHAIR_NAMES = ['ch1', 'ch2', 'ch3'];
const crosshairPics: (unknown | null)[] = [null, null, null];

export const Init_Crosshair = (cgi: CGameImport) => {
    for (let i = 0; i < CROSSHAIR_NAMES.length; i++) {
        const name = CROSSHAIR_NAMES[i];
        try {
            crosshairPics[i] = cgi.Draw_RegisterPic(`pics/${name}.pcx`);
        } catch (e) {
            if (i === 0) {
                 try {
                    crosshairPics[i] = cgi.Draw_RegisterPic('pics/crosshair.pcx');
                } catch (e2) {
                    cgi.Com_Print('Failed to load crosshair image\n');
                }
            }
        }
    }

    crosshairPic = crosshairPics[0];
}

export const Set_Crosshair = (index: number) => {
    // If index is 0, we treat it as disabled if we want to follow Q2 convention strictly,
    // but here index maps to CROSSHAIR_NAMES.
    // If we want a "None" option, we can check for that.

    // For now, let's keep index pointing to textures.
    // We can add a separate enable/disable function or make index -1 disable it.

    if (index === -1) {
        crosshairEnabled = false;
        return;
    }

    crosshairEnabled = true;
    if (index >= 0 && index < crosshairPics.length) {
        crosshairIndex = index;
        crosshairPic = crosshairPics[index];
    }
};

export const Set_CrosshairColor = (r: number, g: number, b: number, a: number = 1) => {
    crosshairColor = [r, g, b, a];
}

export const Cycle_Crosshair = () => {
    // Cycle includes a "None" state (represented by index -1 or just disabling)
    // 0 -> 1 -> 2 -> ... -> Disabled -> 0

    if (!crosshairEnabled) {
        crosshairEnabled = true;
        crosshairIndex = 0;
    } else {
        crosshairIndex++;
        if (crosshairIndex >= CROSSHAIR_NAMES.length) {
            crosshairEnabled = false;
            crosshairIndex = 0; // Reset for next cycle
        }
    }

    if (crosshairEnabled) {
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
    } else {
        crosshairPic = null;
    }

    return crosshairEnabled ? crosshairIndex : -1;
};

export const Draw_Crosshair = (cgi: CGameImport, width: number, height: number) => {
    if (crosshairEnabled && crosshairPic) {
        const size = cgi.Draw_GetPicSize(crosshairPic);
        const x = (width - size.width) / 2;
        const y = (height - size.height) / 2;
        // Draw with color
        cgi.SCR_DrawColorPic(x, y, crosshairPic, { x: crosshairColor[0], y: crosshairColor[1], z: crosshairColor[2] }, crosshairColor[3]);
    }
};
