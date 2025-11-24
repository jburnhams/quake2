import { Renderer } from '@quake2ts/engine';

export class LoadingScreen {
  private total = 0;
  private current = 0;
  private message = '';
  private active = false;

  start(total: number, message: string = 'Loading...') {
    this.total = total;
    this.current = 0;
    this.message = message;
    this.active = true;
  }

  update(current: number, message?: string) {
    this.current = current;
    if (message) {
      this.message = message;
    }
  }

  finish() {
    this.active = false;
    this.current = this.total;
  }

  render(renderer: Renderer) {
    if (!this.active) return;

    const width = renderer.width;
    const height = renderer.height;

    // Draw background
    renderer.drawfillRect(0, 0, width, height, [0.1, 0.1, 0.1, 1]);

    // Draw progress bar
    const barWidth = width * 0.6;
    const barHeight = 20;
    const barX = (width - barWidth) / 2;
    const barY = height * 0.7;

    renderer.drawfillRect(barX, barY, barWidth, barHeight, [0.3, 0.3, 0.3, 1]);

    const progress = this.total > 0 ? this.current / this.total : 0;
    renderer.drawfillRect(barX, barY, barWidth * progress, barHeight, [0.8, 0.5, 0.1, 1]);

    // Draw text
    renderer.drawCenterString(barY - 30, this.message);
    const percent = Math.floor(progress * 100);
    renderer.drawCenterString(barY + barHeight + 10, `${percent}%`);
  }
}
