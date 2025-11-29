import { CGameImport } from '../types.js';

interface Subtitle {
  text: string;
  startTime: number;
  duration: number;
}

const SUBTITLE_DURATION = 3000;

export class SubtitleSystem {
  private subtitle: Subtitle | null = null;

  addSubtitle(text: string, now: number) {
    this.subtitle = {
      text,
      startTime: now,
      duration: SUBTITLE_DURATION,
    };
  }

  drawSubtitles(cgi: CGameImport, now: number) {
    if (!this.subtitle) {
      return;
    }

    if (now > this.subtitle.startTime + this.subtitle.duration) {
      this.subtitle = null;
      return;
    }

    // Draw centered text at the bottom of the screen
    // We assume 240 is roughly 480/2 or similar scale, but typically CGame uses virtual coordinates.
    // If SCR_DrawCenterString uses virtual coords (usually based on 320x240 or similar),
    // we need to know the virtual screen height.
    // However, existing SCR_DrawCenterString likely handles centering horizontally.
    // We just need a Y coordinate.
    // In original Q2, HUD is drawn in a virtual 320x240 space usually, or scaled.
    // Let's assume SCR_DrawCenterString takes a Y coordinate in virtual space.
    // Typically bottom of screen.

    // For now, let's try a reasonable offset from bottom.
    // If standard Q2 res is 320x240, bottom is 240.
    const y = 200;

    cgi.SCR_DrawCenterString(y, this.subtitle.text);
  }
}
