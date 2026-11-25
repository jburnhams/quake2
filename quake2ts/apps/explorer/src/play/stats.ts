// Frame timing for the /play stats readout: frames per second over the last second, the worst gap
// between frames in it (a hitch shows there before it moves the average), and the CPU time each
// frame spent running the game and issuing the draw. GPU time is not in it: WebGL draws after the
// calls return, so a GPU-bound frame shows as a low rate with a small CPU figure.

export type FrameTimings = {
  /** Frames drawn per second, over the last second. */
  fps: number;
  /** The longest time between two frames in that second, in ms. */
  worstFrameMs: number;
  /** Mean CPU time per frame (game frames plus draw calls), in ms. */
  cpuMs: number;
};

const WINDOW_MS = 1000;

export class FrameStats {
  private frames: { at: number; gap: number; cpu: number }[] = [];
  private last = 0;

  /** Records a frame that started at `start` (the rAF timestamp) and took `cpuMs` of script time. */
  frame(start: number, cpuMs: number): void {
    const gap = this.last ? start - this.last : 0;
    this.last = start;
    this.frames.push({ at: start, gap, cpu: cpuMs });
    while (this.frames.length && this.frames[0]!.at <= start - WINDOW_MS) this.frames.shift();
  }

  /** The figures over the last second, or null before two frames have been drawn. */
  read(): FrameTimings | null {
    const timed = this.frames.filter((f) => f.gap > 0);
    if (!timed.length) return null;
    const span = timed.reduce((n, f) => n + f.gap, 0);
    return {
      fps: (timed.length * 1000) / span,
      worstFrameMs: Math.max(...timed.map((f) => f.gap)),
      cpuMs: this.frames.reduce((n, f) => n + f.cpu, 0) / this.frames.length,
    };
  }
}

export type Resolution = {
  /** The canvas's drawing buffer: what the GPU renders. */
  drawn: { width: number; height: number };
  /** The canvas's size on the page, in CSS pixels. */
  shown: { width: number; height: number };
  /** The screen's device pixels per CSS pixel (browser zoom changes it). */
  devicePixelRatio: number;
};

/** How the canvas's drawing buffer compares with its size on screen. */
export function readResolution(canvas: HTMLCanvasElement): Resolution {
  return {
    drawn: { width: canvas.width, height: canvas.height },
    shown: { width: Math.round(canvas.clientWidth), height: Math.round(canvas.clientHeight) },
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}
