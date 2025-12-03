import { Renderer, DemoPlaybackController, PlaybackState } from '@quake2ts/engine';

export class DemoControls {
  private playback: DemoPlaybackController;
  private isVisible: boolean = true;

  constructor(playback: DemoPlaybackController) {
    this.playback = playback;
  }

  public render(renderer: Renderer, width: number, height: number): void {
    if (!this.isVisible) return;

    const state = this.playback.getState();
    const isPlaying = state === PlaybackState.Playing;

    // Bottom overlay
    const overlayHeight = 60;
    const y = height - overlayHeight;
    renderer.drawfillRect(0, y, width, overlayHeight, [0, 0, 0, 0.5]);

    // Play/Pause button
    const iconSize = 24;
    const iconY = y + (overlayHeight - iconSize) / 2;
    const iconX = 20;

    const statusText = isPlaying ? "PAUSE" : "PLAY";
    renderer.drawString(iconX, iconY, statusText);

    // Speed indicator
    const speed = this.playback.getSpeed();
    const speedText = `Speed: ${speed}x`;
    renderer.drawCenterString(iconY, speedText);

    // Time Text (MM:SS / MM:SS) - Stubbed total time for now as metadata tracking is pending
    const currentTime = this.playback.getCurrentTime();
    const currentFormatted = this.formatTime(currentTime);
    // TODO: Get total duration from metadata when available
    const totalFormatted = "--:--";
    const timeText = `${currentFormatted} / ${totalFormatted}`;

    // Position time text to the right
    const timeX = width - 150;
    renderer.drawString(timeX, iconY, timeText);

    // Timeline (Progress Bar)
    const timelineY = y + 5;
    const timelineHeight = 4;
    const timelineWidth = width - 40;
    const timelineX = 20;

    // Draw background bar
    renderer.drawfillRect(timelineX, timelineY, timelineWidth, timelineHeight, [0.3, 0.3, 0.3, 1.0]);

    // Draw progress (Stubbed as 0% for now if total unknown)
    // TODO: Calculate real progress once total time is known
    const progress = 0;
    const progressWidth = timelineWidth * progress;
    renderer.drawfillRect(timelineX, timelineY, progressWidth, timelineHeight, [1.0, 1.0, 1.0, 1.0]);

    // Draw marker
    const markerX = timelineX + progressWidth;
    renderer.drawfillRect(markerX - 2, timelineY - 2, 4, timelineHeight + 4, [1.0, 0.0, 0.0, 1.0]);

    // Controls Help
    // Note: Seeking is implemented as stepping currently
    const helpText = "[Space] Toggle  [< >] Step  [ [ ] ] Speed  [Esc] Stop";
    renderer.drawCenterString(y + 35, helpText);
  }

  public handleInput(key: string, down: boolean): boolean {
    if (!down) return false;

    // We only consume specific keys
    switch (key.toLowerCase()) {
      case ' ':
        if (this.playback.getState() === PlaybackState.Playing) {
          this.playback.pause();
        } else if (this.playback.getState() === PlaybackState.Paused) {
          this.playback.play();
        }
        return true;

      case 'arrowright':
        // Seek forward not fully implemented in controller yet, using step for now
        this.playback.stepForward();
        return true;

      case 'arrowleft':
         this.playback.stepBackward();
         return true;

      case ']':
        this.changeSpeed(2.0); // Multiply by 2
        return true;

      case '[':
        this.changeSpeed(0.5); // Multiply by 0.5
        return true;

      case 'escape':
          this.playback.stop();
          return true;
    }

    return false;
  }

  private changeSpeed(factor: number) {
      const current = this.playback.getSpeed();
      let newSpeed = current * factor;
      if (newSpeed < 0.1) newSpeed = 0.1;
      if (newSpeed > 16) newSpeed = 16;
      this.playback.setSpeed(newSpeed);
  }

  private formatTime(ms: number): string {
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
