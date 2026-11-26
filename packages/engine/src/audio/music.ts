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
  crossfadeDuration?: number; // Seconds, default 1.0
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
  private readonly crossfadeDuration: number;

  private currentElement?: AudioElementLike;
  private fadingElement?: AudioElementLike;

  private track?: string;
  private volume: number;

  private fadeInterval?: any; // Timer handle

  constructor(options: MusicSystemOptions) {
    this.createElement = options.createElement;
    this.resolveSource = options.resolveSource ?? (async (path) => path);
    this.volume = options.volume ?? 1;
    this.crossfadeDuration = options.crossfadeDuration ?? 1.0;
  }

  async playTrack(trackNum: number): Promise<void> {
    // Standard Quake 2 track mapping: track 2 -> music/track02.ogg
    // Tracks 0 and 1 are usually data tracks on the CD and skipped.
    const trackName = `music/track${trackNum.toString().padStart(2, '0')}.ogg`;
    return this.play(trackName);
  }

  async play(track: string, { loop = true, restart = false }: { loop?: boolean; restart?: boolean } = {}): Promise<void> {
    // If requesting the same track
    if (this.track === track && this.currentElement) {
      // If we were fading it out, cancel that and fade back in?
      // For simplicity, if it's the same track and playing, just ensure parameters.
      this.currentElement.loop = loop;

      this.cancelFade();

      // Handle edge case where this track was being faded out
      if (this.fadingElement) {
          this.fadingElement.pause();
          this.fadingElement = undefined;
      }

      this.currentElement.volume = this.volume;

      if (restart) {
        this.currentElement.currentTime = 0;
      }
      if (this.currentElement.paused || restart) {
        await this.currentElement.play();
      }
      return;
    }

    const src = await this.resolveSource(track);

    // Stop any pending fade
    this.cancelFade();

    // If there is already a fading element (from a previous quick switch), stop it immediately
    if (this.fadingElement) {
        this.fadingElement.pause();
        this.fadingElement = undefined;
    }

    // Move current to fading
    if (this.currentElement) {
      this.fadingElement = this.currentElement;
      this.currentElement = undefined;
    }

    // Create new element
    const element = this.createElement();
    element.src = src;
    element.loop = loop;
    element.volume = 0; // Start at 0 for fade in
    element.currentTime = 0;
    element.load();

    try {
      await element.play();
    } catch (e) {
      console.warn(`MusicSystem: Failed to play ${track}`, e);
      // If fail, ensure cleanup
      if (this.fadingElement) {
          // Maybe restore old one? Or just stop.
          // For now, simple fail logic
      }
    }

    this.currentElement = element;
    this.track = track;

    this.startCrossfade();
  }

  pause(): void {
    this.cancelFade();
    if (this.currentElement && !this.currentElement.paused) {
        this.currentElement.pause();
    }
    if (this.fadingElement) {
        this.fadingElement.pause();
        this.fadingElement = undefined;
    }
  }

  async resume(): Promise<void> {
    if (!this.currentElement || !this.currentElement.paused) return;
    await this.currentElement.play();
    this.currentElement.volume = this.volume; // Ensure volume
  }

  stop(): void {
    this.cancelFade();
    if (this.currentElement) {
        this.currentElement.pause();
        this.currentElement.currentTime = 0;
        this.currentElement = undefined;
    }
    if (this.fadingElement) {
        this.fadingElement.pause();
        this.fadingElement = undefined;
    }
    this.track = undefined;
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.currentElement && !this.fadeInterval) {
      this.currentElement.volume = volume;
    }
  }

  getState(): MusicState {
    const playing = Boolean(this.currentElement && !this.currentElement.paused && !this.currentElement.ended);
    const paused = Boolean(this.currentElement?.paused);
    return { track: this.track, paused, playing, volume: this.volume };
  }

  private startCrossfade() {
    const stepTime = 50; // ms
    const steps = (this.crossfadeDuration * 1000) / stepTime;
    const volStep = this.volume / steps;

    let currentVol = 0;
    let fadingVol = this.fadingElement ? this.fadingElement.volume : 0;

    const tick = () => {
        let active = false;

        // Fade In Current
        if (this.currentElement) {
            currentVol = Math.min(this.volume, currentVol + volStep);
            this.currentElement.volume = currentVol;
            if (currentVol < this.volume) active = true;
        }

        // Fade Out Old
        if (this.fadingElement) {
            fadingVol = Math.max(0, fadingVol - volStep);
            this.fadingElement.volume = fadingVol;
            if (fadingVol > 0) {
                active = true;
            } else {
                // Done fading out
                this.fadingElement.pause();
                this.fadingElement = undefined;
            }
        }

        if (!active) {
            this.cancelFade();
        }
    };

    // Execute first tick immediately to avoid latency
    tick();

    // If still active (more steps needed), schedule interval
    if (this.currentElement && this.currentElement.volume < this.volume || this.fadingElement) {
       this.fadeInterval = setInterval(tick, stepTime);
    }
  }

  private cancelFade() {
      if (this.fadeInterval) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = undefined;
      }
  }
}
