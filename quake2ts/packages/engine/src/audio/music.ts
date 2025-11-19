export interface AudioElementLike {
  src: string;
  loop: boolean;
  volume: number;
  currentTime: number;
  paused: boolean;
  ended: boolean;
  play(): Promise<void>;
  pause(): void;
  load(): void;
}

export type AudioElementFactory = () => AudioElementLike;
export type MusicSourceResolver = (path: string) => Promise<string>;

export interface MusicSystemOptions {
  createElement: AudioElementFactory;
  resolveSource?: MusicSourceResolver;
  volume?: number;
}

export interface MusicState {
  readonly track?: string;
  readonly paused: boolean;
  readonly playing: boolean;
  readonly volume: number;
}

export class MusicSystem {
  private readonly createElement: AudioElementFactory;
  private readonly resolveSource: MusicSourceResolver;
  private element?: AudioElementLike;
  private track?: string;
  private volume: number;

  constructor(options: MusicSystemOptions) {
    this.createElement = options.createElement;
    this.resolveSource = options.resolveSource ?? (async (path) => path);
    this.volume = options.volume ?? 1;
  }

  async play(track: string, { loop = true, restart = false }: { loop?: boolean; restart?: boolean } = {}): Promise<void> {
    if (this.track === track && this.element) {
      this.element.loop = loop;
      this.element.volume = this.volume;
      if (restart) {
        this.element.currentTime = 0;
      }
      if (this.element.paused || restart) {
        await this.element.play();
      }
      return;
    }

    const src = await this.resolveSource(track);
    const element = this.createElement();
    element.src = src;
    element.loop = loop;
    element.volume = this.volume;
    element.currentTime = 0;
    element.load();
    await element.play();

    this.element = element;
    this.track = track;
  }

  pause(): void {
    if (!this.element || this.element.paused) return;
    this.element.pause();
  }

  async resume(): Promise<void> {
    if (!this.element || !this.element.paused) return;
    await this.element.play();
  }

  stop(): void {
    if (!this.element) return;
    this.element.pause();
    this.element.currentTime = 0;
    this.element = undefined;
    this.track = undefined;
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.element) {
      this.element.volume = volume;
    }
  }

  getState(): MusicState {
    const playing = Boolean(this.element && !this.element.paused && !this.element.ended);
    const paused = Boolean(this.element?.paused);
    return { track: this.track, paused, playing, volume: this.volume };
  }
}
