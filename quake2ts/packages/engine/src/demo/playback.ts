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
  }

  public setFrameDuration(ms: number) {
      this.frameDuration = ms;
  }

  public update(dt: number) {
    if (this.state !== PlaybackState.Playing || !this.reader) {
      return;
    }

    this.accumulatedTime += dt * 1000 * this.playbackSpeed; // Convert to ms

    while (this.accumulatedTime >= this.frameDuration) {
        if (!this.reader.hasMore()) {
            this.state = PlaybackState.Finished;
            return;
        }

        const block = this.reader.readNextBlock();
        if (!block) {
            this.state = PlaybackState.Finished;
            return;
        }

        const parser = new NetworkMessageParser(block.data, this.handler);
        parser.parseMessage();
        this.accumulatedTime -= this.frameDuration;
    }
  }

  public getState(): PlaybackState {
      return this.state;
  }
}
