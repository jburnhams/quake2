import { Renderer } from '@quake2ts/engine';
import { DemoPlaybackController, PlaybackState } from '@quake2ts/engine';

export class DemoControls {
    private controller: DemoPlaybackController;
    private isVisible: boolean = true;
    private showTime: number = 0;
    private lastInteractionTime: number = 0;

    constructor(controller: DemoPlaybackController) {
        this.controller = controller;
    }

    public update(dt: number) {
        if (this.isVisible) {
            this.showTime += dt;
        }

        // Auto-hide after 3 seconds of no interaction?
        // if (Date.now() - this.lastInteractionTime > 3000) this.isVisible = false;
    }

    public render(renderer: Renderer, width: number, height: number) {
        if (!this.isVisible) return;
        if (!renderer) return;

        // Draw overlay bar at bottom
        const barHeight = 40;
        const y = height - barHeight;

        // We need 2D drawing primitives.
        // Assuming renderer.drawRect or similar exists, or we use standard 2D context emulation?
        // The Renderer interface has `drawPic`, `drawChar`, `drawString`.
        // It might not have `drawRect`.
        // We can use a 1x1 white texture scaled up for rects if available, or just draw text/icons.

        // Draw Play/Pause Status
        const state = this.controller.getState();
        const stateStr = state === PlaybackState.Playing ? "PLAYING" :
                         state === PlaybackState.Paused ? "PAUSED" :
                         state === PlaybackState.Finished ? "FINISHED" : "STOPPED";

        renderer.drawString(stateStr, 10, y + 10);

        // Draw Time
        // getCurrentTime() returns accumulated interpolation time.
        // We don't have total demo duration yet exposed easily on controller without parsing whole file?
        // Task 1.5 adds getTotalFrames.
        // For now just show current time.
        // But getCurrentTime() resets every frame!
        // We need TOTAL playback time.
        // The controller accumulates time but resets it.
        // We need to track total time in controller?
        // Task 1.5 mentions `getDuration()`.

        // For now, let's just show controls help.
        const help = "[Space] Pause/Play  [<] [>] Seek  [-] [+] Speed  [Esc] Stop";
        renderer.drawString(help, width / 2 - (help.length * 8) / 2, y + 10);

        // Draw Speed
        // Controller doesn't expose getSpeed() yet?
        // It has `playbackSpeed` private.
        // We should assume we can get it or track it.
        // Let's add getSpeed to controller later.
    }

    public handleInput(key: string, down: boolean): boolean {
        this.lastInteractionTime = Date.now();
        this.isVisible = true;

        if (!down) return false;

        switch (key.toLowerCase()) {
            case ' ': // Space
            case 'k':
                if (this.controller.getState() === PlaybackState.Playing) {
                    this.controller.pause();
                } else {
                    this.controller.play();
                }
                return true;

            case 'arrowright':
                // Seek forward 5s
                // Not implemented in controller yet (Task 1.5)
                return true;

            case 'arrowleft':
                // Seek back 5s
                return true;

            case '=':
            case '+':
                // Increase speed
                // Need setSpeed on controller (Task 1.5)
                return true;

            case '-':
            case '_':
                // Decrease speed
                return true;

            case 'escape':
                this.controller.stop();
                return true; // Will also probably close demo mode in client
        }

        return false;
    }
}
