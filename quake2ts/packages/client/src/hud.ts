import { PakArchive } from '@quake2ts/engine';
import { Pic, Renderer } from '@quake2ts/engine';
import { Draw_Number } from './hud/numbers.js';
import { HUD_LAYOUT } from './hud/layout.js';

const hudNumberPics: Pic[] = [];
let numberWidth = 0;

export const Init_Hud = async (renderer: Renderer, pak: PakArchive) => {
    for (let i = 0; i < 10; i++) {
        try {
            const data = pak.readFile(`pics/hud/num_${i}.png`);
            const pic = await renderer.registerPic(`hud_num_${i}`, data.buffer as ArrayBuffer);
            hudNumberPics.push(pic);
        } catch (e) {
            console.error(`Failed to load HUD image: pics/hud/num_${i}.png`);
        }
    }
    if (hudNumberPics[0]) {
        numberWidth = hudNumberPics[0].width;
    }
};

export const Draw_Hud = (renderer: Renderer, health: number, armor: number, ammo: number) => {
    renderer.begin2D();
    Draw_Number(renderer, HUD_LAYOUT.HEALTH_X, HUD_LAYOUT.HEALTH_Y, health, hudNumberPics, numberWidth);
    Draw_Number(renderer, HUD_LAYOUT.ARMOR_X, HUD_LAYOUT.ARMOR_Y, armor, hudNumberPics, numberWidth);
    Draw_Number(renderer, HUD_LAYOUT.AMMO_X, HUD_LAYOUT.AMMO_Y, ammo, hudNumberPics, numberWidth);
    renderer.end2D();
};
