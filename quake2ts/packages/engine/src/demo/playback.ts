import { DemoReader } from './reader.js';
import { NetworkMessageParser } from './parser.js';
import { BinaryStream } from '@quake2ts/shared';

export enum PlaybackState {
  Stopped,
  Playing,
  Paused,
  Finished
}

export class DemoPlaybackController {
  private reader: DemoReader | null = null;
  private state: PlaybackState = PlaybackState.Stopped;
  private parser: NetworkMessageParser | null = null;

  // Timing control
  private lastFrameTime = 0;
  private accumulator = 0;
  private playbackSpeed = 1.0;

  constructor() {}

  public loadDemo(buffer: ArrayBuffer): void {
    this.reader = new DemoReader(buffer);
    this.state = PlaybackState.Stopped;
  }

  public play(): void {
    if (!this.reader) {
      console.warn("No demo loaded.");
      return;
    }
    this.state = PlaybackState.Playing;
    this.lastFrameTime = performance.now();
  }

  public pause(): void {
    this.state = PlaybackState.Paused;
  }

  public stop(): void {
    this.state = PlaybackState.Stopped;
  }

  public update(): void {
    if (this.state !== PlaybackState.Playing || !this.reader) {
      return;
    }

    const now = performance.now();
    const delta = (now - this.lastFrameTime) * this.playbackSpeed;
    this.lastFrameTime = now;

    // In a real implementation, we would use the delta to pace the demo.
    // For this MVP, we will just try to read one block per update() call
    // or match the server frame rate (10Hz typically, but we render at 60Hz).
    // Standard Q2 demo playback is frame-based. We need to read until the next 'frame' command
    // or pace it based on the `serverFrame` info if available.

    // For now, let's just read one block per update loop to verify parsing.
    // A real implementation needs a more sophisticated scheduler.

    try {
       const block = this.reader.readNextBlock();
       if (block) {
           const stream = new BinaryStream(block.data);
           const parser = new NetworkMessageParser(stream);
           parser.parseMessage();
       } else {
           this.state = PlaybackState.Finished;
           console.log("Demo finished.");
       }
    } catch (e) {
        console.error("Error reading demo block:", e);
        this.state = PlaybackState.Stopped;
    }
  }

  public getState(): PlaybackState {
      return this.state;
  }
}
