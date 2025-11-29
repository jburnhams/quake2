/**
 * CGame HUD Screen Drawing
 * Reference: rerelease/cg_screen.cpp
 *
 * This module handles all HUD rendering for the cgame package, including:
 * - Status bar (health, armor, ammo)
 * - Crosshair
 * - Damage indicators
 * - Pickup notifications
 * - Messages and center print
 * - Subtitles
 */

import type { PlayerState } from '@quake2ts/shared';
import type { CGameImport } from './types.js';

// HUD component imports
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

// Module-level state
let cgi: CGameImport | null = null;
const hudNumberPics: unknown[] = []; // Will hold pic handles from cgi.Draw_RegisterPic()
let numberWidth = 0;

// Message and subtitle systems
const messageSystem = new MessageSystem();
const subtitleSystem = new SubtitleSystem();

/**
 * Initialize the CGame screen module with import functions.
 * Reference: rerelease/cg_screen.cpp InitCGame()
 */
export function CG_InitScreen(imports: CGameImport): void {
    cgi = imports;
}

/**
 * Precache all HUD images.
 * Reference: rerelease/cg_screen.cpp:1689 (TouchPics)
 *
 * This is called during level load to register all required HUD assets.
 */
export function CG_TouchPics(): void {
    if (!cgi) return;

    // Load HUD number pics
    hudNumberPics.length = 0;
    for (let i = 0; i < 10; i++) {
        try {
            const pic = cgi.Draw_RegisterPic(`pics/hud/num_${i}.pcx`);
            hudNumberPics.push(pic);
            if (i === 0) {
                const size = cgi.Draw_GetPicSize(pic);
                numberWidth = size.width;
            }
        } catch (e) {
            cgi.Com_Print(`Warning: Failed to load HUD image: pics/hud/num_${i}.pcx\n`);
        }
    }

    Init_Crosshair(cgi);
    Init_Icons(cgi);
    Init_Damage(cgi);
}

/**
 * Main HUD drawing function.
 * Reference: rerelease/cg_screen.cpp CG_DrawHUD()
 *
 * Called each frame by the client to render the HUD overlay.
 *
 * @param isplit - Split-screen index (0 for single player)
 * @param data - Additional HUD data (unused in initial implementation)
 * @param hud_vrect - Virtual HUD rectangle (screen coordinates)
 * @param hud_safe - Safe area rectangle (for overscan)
 * @param scale - HUD scale factor
 * @param playernum - Player number
 * @param ps - Current player state
 */
export function CG_DrawHUD(
    isplit: number,
    data: unknown,
    hud_vrect: { x: number; y: number; width: number; height: number },
    hud_safe: { x: number; y: number; width: number; height: number },
    scale: number,
    playernum: number,
    ps: PlayerState
): void {
    if (!cgi) {
        console.error('CG_DrawHUD: cgame imports not initialized');
        return;
    }

    const timeMs = cgi.CL_ClientTime();
    const layout = getHudLayout(hud_vrect.width, hud_vrect.height);

    // Screen blends (damage, powerups)
    Draw_Blends(cgi, ps, hud_vrect.width, hud_vrect.height);

    // Status bar
    // Now directly using ps.stats via Draw_StatusBar
    Draw_StatusBar(cgi, ps, hudNumberPics, numberWidth, timeMs, layout);

    // Pickup messages
    Draw_Pickup(cgi, ps, hud_vrect.width, hud_vrect.height);

    // Damage indicators
    Draw_Damage(cgi, ps, hud_vrect.width, hud_vrect.height);

    // Center print (Legacy PS support)
    if (ps.centerPrint) {
        const lines = ps.centerPrint.split('\n');
        let y = hud_vrect.height / 2 - (lines.length * 10); // Approximation
        for (const line of lines) {
             cgi.SCR_DrawCenterString(y, line);
             y += 16;
        }
    }

    // Message System (CenterPrint & Notifications)
    messageSystem.drawCenterPrint(cgi, timeMs, layout);
    messageSystem.drawNotifications(cgi, timeMs);

    // Subtitles
    // subtitleSystem.draw(cgi, ...); // TODO: SubtitleSystem needs refactoring to use cgi

    // Crosshair
    Draw_Crosshair(cgi, hud_vrect.width, hud_vrect.height);
}

/**
 * Get message system instance.
 * Used by parsing functions to add messages.
 */
export function CG_GetMessageSystem(): MessageSystem {
    return messageSystem;
}

/**
 * Get subtitle system instance.
 * Used by audio system to display subtitles.
 */
export function CG_GetSubtitleSystem(): SubtitleSystem {
    return subtitleSystem;
}
