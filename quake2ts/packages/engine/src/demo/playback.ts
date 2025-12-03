import { DemoReader } from './demoReader.js';
import { NetworkMessageParser, NetworkMessageHandler } from './parser.js';

export enum PlaybackState {
  Stopped,
  Playing,
  Paused,
  Finished
}

export class DemoPlaybackController {
  private reader: DemoReader | null = null;
  private state: PlaybackState = PlaybackState.Stopped;
  private playbackSpeed: number = 1.0;
  private handler?: NetworkMessageHandler;
  private currentProtocolVersion: number = 0;

  // Timing
  private accumulatedTime: number = 0;
  private frameDuration: number = 100; // ms (10Hz default)

  constructor() {}

  public setHandler(handler: NetworkMessageHandler) {
      this.handler = handler;
  }

  public loadDemo(buffer: ArrayBuffer) {
    this.reader = new DemoReader(buffer);
    this.state = PlaybackState.Stopped;
    this.accumulatedTime = 0;
    this.currentProtocolVersion = 0;
  }

  public play() {
    if (this.reader) {
      this.state = PlaybackState.Playing;
    }
  }

  public pause() {
    if (this.state === PlaybackState.Playing) {
      this.state = PlaybackState.Paused;
    }
  }

  public stop() {
    this.state = PlaybackState.Stopped;
    if (this.reader) {
      this.reader.reset();
    }
    this.accumulatedTime = 0;
    this.currentProtocolVersion = 0;
  }

  public setFrameDuration(ms: number) {
      this.frameDuration = ms;
  }

  public setSpeed(speed: number) {
      // Clamp speed between 0.1x and 16x as per requirements
      this.playbackSpeed = Math.max(0.1, Math.min(speed, 16.0));
  }

  public getSpeed(): number {
      return this.playbackSpeed;
  }

  public update(dt: number) {
    if (this.state !== PlaybackState.Playing || !this.reader) {
      return;
    }

    this.accumulatedTime += dt * 1000 * this.playbackSpeed; // Convert to ms

    while (this.accumulatedTime >= this.frameDuration) {
        const hasMore = this.processNextFrame();
        if (!hasMore) {
            return;
        }
        this.accumulatedTime -= this.frameDuration;
    }
  }

  public stepForward() {
    if (!this.reader) return;

    // Process one frame immediately
    this.processNextFrame();
  }

  public stepBackward() {
      // Not implemented yet - requires seeking or history
      console.warn("stepBackward not implemented");
  }

  private processNextFrame(): boolean {
      if (!this.reader || !this.reader.hasMore()) {
          this.state = PlaybackState.Finished;
          return false;
      }

      const block = this.reader.readNextBlock();
      if (!block) {
          this.state = PlaybackState.Finished;
          return false;
      }

      const parser = new NetworkMessageParser(block.data, this.handler);
      // Persist protocol version across frames
      parser.setProtocolVersion(this.currentProtocolVersion);
      parser.parseMessage();
      // Update protocol version in case it changed (e.g. serverdata)
      this.currentProtocolVersion = parser.getProtocolVersion();

      return true;
  }

  public getState(): PlaybackState {
      return this.state;
  }

  public getCurrentTime(): number {
      return this.accumulatedTime;
  }
}
