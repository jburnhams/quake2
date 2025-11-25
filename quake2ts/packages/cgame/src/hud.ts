import { PlayerState } from '@quake2ts/shared';
import { Draw_Crosshair, Init_Crosshair } from './hud/crosshair.js';
import { Init_Icons } from './hud/icons.js';
import { Draw_Damage, Init_Damage } from './hud/damage.js';
import { Draw_Diagnostics } from './hud/diagnostics.js';
import { MessageSystem } from './hud/messages.js';
import { SubtitleSystem } from './hud/subtitles.js';
import { Draw_Blends } from './hud/blends.js';
import { Draw_Pickup } from './hud/pickup.js';
import { Draw_StatusBar } from './hud/statusbar.js';
import { getHudLayout } from './hud/layout.js';
import { FrameRenderStats, Pic, Renderer, PlayerClient } from '@quake2ts/shared/dist/cgame/interfaces';

// TODO: This interface is a temporary placeholder.
export interface AssetManager {
    loadTexture: (path: string) => Promise<any>;
}

export class Hud {
    private hudNumberPics: Pic[] = [];
    private numberWidth = 0;

    constructor() {

    }

    async Init(renderer: Renderer, assets: AssetManager) {
        for (let i = 0; i < 10; i++) {
            try {
                const texture = await assets.loadTexture(`pics/hud/num_${i}.pcx`);
                const pic = renderer.registerTexture(`hud_num_${i}`, texture);
                this.hudNumberPics.push(pic);
            } catch (e) {
                console.error(`Failed to load HUD image: pics/hud/num_${i}.pcx`, e);
            }
        }
        if (this.hudNumberPics.length > 0) {
            this.numberWidth = this.hudNumberPics[0].width;
        }

        await Init_Crosshair(renderer, assets);
        await Init_Icons(renderer, assets);
        await Init_Damage(renderer, assets);
    }

    Draw(
        renderer: Renderer,
        ps: PlayerState,
        client: PlayerClient,
        health: number,
        armor: number,
        ammo: number,
        stats: FrameRenderStats,
        messageSystem: MessageSystem,
        subtitleSystem: SubtitleSystem,
        timeMs: number
    ) {
        renderer.begin2D();

        Draw_Blends(renderer, ps);

        if (ps.damageAlpha > 0) {
            renderer.drawfillRect(0, 0, renderer.width, renderer.height, [1, 0, 0, ps.damageAlpha]);
        }

        const layout = getHudLayout(renderer.width, renderer.height);

        Draw_StatusBar(renderer, client, health, armor, ammo, this.hudNumberPics, this.numberWidth, timeMs, layout);

        Draw_Pickup(renderer, ps);

        Draw_Damage(renderer, ps);
        Draw_Diagnostics(renderer, stats);

        messageSystem.drawCenterPrint(renderer, timeMs, layout);
        messageSystem.drawNotifications(renderer, timeMs);
        subtitleSystem.drawSubtitles(renderer, timeMs);

        if (ps.centerPrint) {
            // Use layout for position?
            // Or keep hardcoded logic relative to layout.
            // Assuming renderer.height/2 is always center.
            renderer.drawCenterString(renderer.height / 2 - 20, ps.centerPrint);
        }

        if (ps.notify) {
            renderer.drawString(8, 8, ps.notify);
        }

        Draw_Crosshair(renderer, renderer.width, renderer.height);
        renderer.end2D();
    };
}
