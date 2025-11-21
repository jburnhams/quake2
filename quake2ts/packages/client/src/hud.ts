import { PakArchive } from '@quake2ts/engine';
import { Pic, Renderer } from '@quake2ts/engine';
import { Draw_Number } from './hud/numbers.js';
import { HUD_LAYOUT } from './hud/layout.js';

const hudNumberPics: Pic[] = [];
const NUMBER_WIDTH = 20; // TODO: get this from the image size

export const Init_Hud = async (renderer: Renderer, pak: PakArchive) => {
    for (let i = 0; i < 10; i++) {
        // This assumes the PAK file has been loaded and contains the HUD images.
        const data = pak.readFile(`pics/hud/num_${i}.png`);
        const pic = await renderer.registerPic(`hud_num_${i}`, data.buffer);
        hudNumberPics.push(pic);
    }
};

export const Draw_Hud = (renderer: Renderer, health: number, armor: number, ammo: number) => {
    Draw_Number(renderer, HUD_LAYOUT.HEALTH_X, HUD_LAYOUT.HEALTH_Y, health, hudNumberPics, NUMBER_WIDTH);
    Draw_Number(renderer, HUD_LAYOUT.ARMOR_X, HUD_LAYOUT.ARMOR_Y, armor, hudNumberPics, NUMBER_WIDTH);
    Draw_Number(renderer, HUD_LAYOUT.AMMO_X, HUD_LAYOUT.AMMO_Y, ammo, hudNumberPics, NUMBER_WIDTH);
};
