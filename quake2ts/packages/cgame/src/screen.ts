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

    // TODO: Call Init functions for other HUD components
    // These will need to be adapted to use cgi.Draw_RegisterPic()
    // instead of direct asset manager access
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

    // TODO: Implement full HUD rendering using cgi drawing functions
    // For now, this is a placeholder structure

    // The full implementation will need to:
    // 1. Read stats from ps.stats[] array using STAT_* constants
    // 2. Use cgi.SCR_DrawPic(), cgi.SCR_DrawChar(), etc. for rendering
    // 3. Calculate layout based on hud_vrect and hud_safe
    // 4. Draw all HUD components in correct order:
    //    - Screen blends (damage, powerups)
    //    - Status bar
    //    - Pickup messages
    //    - Damage indicators
    //    - Center print
    //    - Notifications
    //    - Subtitles
    //    - Crosshair

    const timeMs = cgi.CL_ClientTime();
    const layout = getHudLayout(hud_vrect.width, hud_vrect.height);

    // Basic placeholder rendering
    // TODO: Adapt each Draw_* function to use cgi instead of renderer

    if (ps.centerPrint) {
        cgi.SCR_DrawFontString(
            hud_vrect.width / 2,
            hud_vrect.height / 2 - 20,
            ps.centerPrint
        );
    }

    if (ps.notify) {
        cgi.SCR_DrawFontString(8, 8, ps.notify);
    }
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
