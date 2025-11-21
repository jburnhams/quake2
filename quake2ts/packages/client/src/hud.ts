import { PakArchive } from '../../engine/src/assets/pak.js';
import { Draw_RegisterPic } from '../../engine/src/render/draw.js';
import { Draw_Number } from './hud/numbers.js';
import { HUD_LAYOUT } from './hud/layout.js';

const hudNumberPics: number[] = [];
const NUMBER_WIDTH = 20; // TODO: get this from the image size

export const Init_Hud = async (pak: PakArchive) => {
    for (let i = 0; i < 10; i++) {
        const pic = await Draw_RegisterPic(pak, `pics/hud/num_${i}.png`);
        hudNumberPics.push(pic);
    }
};

export const Draw_Hud = (health: number, armor: number, ammo: number) => {
    Draw_Number(HUD_LAYOUT.HEALTH_X, HUD_LAYOUT.HEALTH_Y, health, hudNumberPics, NUMBER_WIDTH);
    Draw_Number(HUD_LAYOUT.ARMOR_X, HUD_LAYOUT.ARMOR_Y, armor, hudNumberPics, NUMBER_WIDTH);
    Draw_Number(HUD_LAYOUT.AMMO_X, HUD_LAYOUT.AMMO_Y, ammo, hudNumberPics, NUMBER_WIDTH);
};
