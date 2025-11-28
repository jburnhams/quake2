import { CGameImport } from '../types.js';
import { PlayerState } from '@quake2ts/shared';

export const Draw_Blends = (cgi: CGameImport, ps: PlayerState, width: number, height: number) => {
    if (!ps.blend) return;

    const [r, g, b, a] = ps.blend;

    if (a > 0) {
        // Use SCR_DrawColorPic with a white pixel/texture stretched?
        // Or cgi needs a fill rect function.
        // SCR_DrawPic usually takes a pic.
        // Rerelease might use a specific blend function or just a 1x1 white texture scaled up.
        // Assuming cgi can draw colored quads if we register a "white" texture or similar.
        // For now, let's assume we can draw a colored rectangle if we had a white texture.

        // Since we don't have a fillRect in CGameImport, we might need to add it or use a registered texture.
        // Let's assume for now we skip or need to register a 'pics/white.pcx' or similar if it existed.
        // A common trick is to use any opaque texture and tint it, but that shows the texture.

        // Let's defer this or add a "DrawFill" to CGameImport if strictly needed,
        // OR standard Q2 just uses the poly drawing which isn't exposed yet.
        // Actually, Q2 V_CalcBlend handles this by setting palette/gamma or drawing a full screen poly.

        // For this port, we likely want a SCR_DrawFill calls.
        // Let's add SCR_DrawFill to CGameImport in types.ts in next step if it's missing.
        // Checking types.ts... it has SCR_DrawChar, SCR_DrawPic... no DrawFill.

        // I'll leave it commented/TODO for now or assume a 'white' pic is available.
        // cgi.SCR_DrawColorPic(0, 0, whitePic, {x:r, y:g, z:b}, a);
    }
};
