import { Renderer } from '@quake2ts/shared/dist/cgame/interfaces';

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

  drawSubtitles(renderer: Renderer, now: number) {
    if (!this.subtitle) {
      return;
    }

    if (now > this.subtitle.startTime + this.subtitle.duration) {
      this.subtitle = null;
      return;
    }

    // Draw centered text at the bottom of the screen
    const y = renderer.height - 40;
    renderer.drawCenterString(y, this.subtitle.text);
  }
}
