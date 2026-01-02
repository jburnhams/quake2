import { describe, it, expect, vi } from 'vitest';
import { Draw_StatusBar } from '../../../src/hud/statusbar.js';
import { CGameImport } from '../../../src/types.js';
import { PlayerState, PlayerStat } from '@quake2ts/shared';
import { getHudLayout } from '../../../src/hud/layout.js';

describe('Draw_StatusBar', () => {
  it('should draw health, armor, and ammo from ps.stats', () => {
    // Mock CGameImport
    const cgi = {
      SCR_DrawPic: vi.fn(),
      Draw_GetPicSize: vi.fn(() => ({ width: 10, height: 10 })),
      Draw_RegisterPic: vi.fn((name) => `mock_pic_${name}`),
      SCR_DrawChar: vi.fn(),
      SCR_DrawColorPic: vi.fn(),
      SCR_MeasureFontString: vi.fn(() => 100),
      SCR_DrawFontString: vi.fn(),
    } as unknown as CGameImport;

    // Mock PlayerState
    const ps = {
      stats: [] as number[],
      pickupIcon: 'w_shotgun', // Fallback
    } as unknown as PlayerState;

    // Set stats
    ps.stats[PlayerStat.STAT_HEALTH] = 88;
    ps.stats[PlayerStat.STAT_ARMOR] = 50;
    ps.stats[PlayerStat.STAT_AMMO] = 25; // raw value for now, assuming helper matches

    const layout = getHudLayout(640, 480);
    const hudNumberPics = Array(10).fill('num_pic');
    const numberWidth = 24;
    const timeMs = 1000;

    Draw_StatusBar(cgi, ps, hudNumberPics, numberWidth, timeMs, layout);

    // Verify drawing calls
    // We expect SCR_DrawPic to be called for numbers (health, armor, ammo)
    // Draw_Number helper calls SCR_DrawPic internally
    expect(cgi.SCR_DrawPic).toHaveBeenCalled();

    // Specifically, we should see numbers being drawn.
    // 88 (2 digits), 50 (2 digits), 25 (2 digits) -> 6 calls for numbers
    // Plus one for weapon icon (fallback)
    expect(cgi.SCR_DrawPic).toHaveBeenCalledTimes(6 + 1);
  });

  it('should handle missing stats gracefully', () => {
     const cgi = {
      SCR_DrawPic: vi.fn(),
      Draw_GetPicSize: vi.fn(() => ({ width: 10, height: 10 })),
      Draw_RegisterPic: vi.fn(),
    } as unknown as CGameImport;

    const ps = {
      stats: [], // Empty stats
    } as unknown as PlayerState;

    const layout = getHudLayout(640, 480);
    Draw_StatusBar(cgi, ps, [], 24, 1000, layout);

    // Should draw zeros or nothing if number pics are empty
    // But logic says: if (hudNumberPics.length > 0)
    // We passed empty array, so no numbers drawn.
    expect(cgi.SCR_DrawPic).not.toHaveBeenCalled();
  });
});
