import { FrameRenderStats, AssetManager } from '@quake2ts/engine';
import { Pic, Renderer } from '@quake2ts/engine';
import { PlayerClient } from '@quake2ts/game';
import { PlayerState } from '@quake2ts/shared';
import { Draw_Number } from './hud/numbers.js';
import { HUD_LAYOUT } from './hud/layout.js';
import { Draw_Crosshair, Init_Crosshair } from './hud/crosshair.js';
import { Draw_Icons, Init_Icons } from './hud/icons.js';
import { Draw_Damage, Init_Damage } from './hud/damage.js';
import { Draw_Diagnostics } from './hud/diagnostics.js';
import { MessageSystem } from './hud/messages.js';
import { Draw_Blends } from './hud/blends.js';
import { Draw_Pickup } from './hud/pickup.js';

const hudNumberPics: Pic[] = [];
let numberWidth = 0;

export const Init_Hud = async (renderer: Renderer, assets: AssetManager) => {
    for (let i = 0; i < 10; i++) {
        try {
            const texture = await assets.loadTexture(`pics/hud/num_${i}.pcx`);
            const pic = renderer.registerTexture(`hud_num_${i}`, texture);
            hudNumberPics.push(pic);
        } catch (e) {
            console.error(`Failed to load HUD image: pics/hud/num_${i}.pcx`, e);
        }
    }
    if (hudNumberPics.length > 0) {
        numberWidth = hudNumberPics[0].width;
    }

    await Init_Crosshair(renderer, assets);
    await Init_Icons(renderer, assets);
    await Init_Damage(renderer, assets);
};

export const Draw_Hud = (
    renderer: Renderer,
    ps: PlayerState,
    client: PlayerClient,
    health: number,
    armor: number,
    ammo: number,
    stats: FrameRenderStats,
    messageSystem: MessageSystem,
    timeMs: number
) => {
    renderer.begin2D();

    Draw_Blends(renderer, ps);

    if (ps.damageAlpha > 0) {
        renderer.drawfillRect(0, 0, renderer.width, renderer.height, [1, 0, 0, ps.damageAlpha]);
    }

    const healthColor: [number, number, number, number] | undefined = health <= 25
        ? [1, 0, 0, 1] // Red for low health
        : undefined;

    if (hudNumberPics.length > 0) {
        Draw_Number(renderer, HUD_LAYOUT.HEALTH_X, HUD_LAYOUT.HEALTH_Y, health, hudNumberPics, numberWidth, healthColor);
        Draw_Number(renderer, HUD_LAYOUT.ARMOR_X, HUD_LAYOUT.ARMOR_Y, armor, hudNumberPics, numberWidth);
        Draw_Number(renderer, HUD_LAYOUT.AMMO_X, HUD_LAYOUT.AMMO_Y, ammo, hudNumberPics, numberWidth);
    }

    Draw_Icons(renderer, client, hudNumberPics, numberWidth, timeMs);
    Draw_Pickup(renderer, ps);

    Draw_Damage(renderer, ps);
    Draw_Diagnostics(renderer, stats);

    messageSystem.drawCenterPrint(renderer, timeMs);
    messageSystem.drawNotifications(renderer, timeMs);

    if (ps.centerPrint) {
        renderer.drawCenterString(renderer.height / 2 - 20, ps.centerPrint);
    }

    if (ps.notify) {
        renderer.drawString(8, 8, ps.notify);
    }

    Draw_Crosshair(renderer, renderer.width, renderer.height);
    renderer.end2D();
};
