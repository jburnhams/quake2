import {
  ConfigStringIndex,
  MAX_MODELS,
  MAX_SOUNDS,
  MAX_IMAGES,
} from '@quake2ts/shared';

/**
 * Handles parsing and storage of config strings on the client side.
 * Maintains mappings of indices to resource names (models, sounds, images).
 */
export class ClientConfigStrings {
  private readonly strings: Map<number, string> = new Map();
  private readonly models: string[] = [];
  private readonly sounds: string[] = [];
  private readonly images: string[] = [];

  constructor() {
    // Initialize arrays with empty strings or nulls as needed
    // In JS/TS, sparse arrays or checking for undefined is common,
    // but C array emulation suggests fixed sizing or explicit bounds.
  }

  /**
   * Called when a config string is received from the server.
   */
  public set(index: number, value: string): void {
    this.strings.set(index, value);

    if (index >= ConfigStringIndex.Models && index < ConfigStringIndex.Models + MAX_MODELS) {
      const modelIndex = index - ConfigStringIndex.Models;
      this.models[modelIndex] = value;
    } else if (index >= ConfigStringIndex.Sounds && index < ConfigStringIndex.Sounds + MAX_SOUNDS) {
      const soundIndex = index - ConfigStringIndex.Sounds;
      this.sounds[soundIndex] = value;
    } else if (index >= ConfigStringIndex.Images && index < ConfigStringIndex.Images + MAX_IMAGES) {
      const imageIndex = index - ConfigStringIndex.Images;
      this.images[imageIndex] = value;
    }
  }

  public get(index: number): string | undefined {
    return this.strings.get(index);
  }

  public getModelName(index: number): string | undefined {
    return this.models[index];
  }

  public getSoundName(index: number): string | undefined {
    return this.sounds[index];
  }

  public getImageName(index: number): string | undefined {
    return this.images[index];
  }

  public getPlayerName(playernum: number): string | undefined {
    const csIndex = ConfigStringIndex.Players + playernum;
    const info = this.strings.get(csIndex);
    if (!info) return undefined;
    // Player info is a userinfo string: \name\Player\skin\male/grunt...
    // We need to parse it to get the name.
    // Simple parse: extract value for 'name' key.
    const parts = info.split('\\');
    for (let i = 1; i < parts.length; i += 2) {
      if (parts[i] === 'name') {
        return parts[i + 1];
      }
    }
    return undefined;
  }

  public clear(): void {
    this.strings.clear();
    this.models.length = 0;
    this.sounds.length = 0;
    this.images.length = 0;
  }
}
