import {
  ConfigStringIndex,
  CS_MAX_STRING_LENGTH,
  MAX_CONFIGSTRINGS,
  MAX_GENERAL,
  MAX_IMAGES,
  MAX_ITEMS,
  MAX_LIGHTSTYLES,
  MAX_MODELS,
  MAX_CLIENTS,
  MAX_SHADOW_LIGHTS,
  MAX_SOUNDS,
  MAX_WHEEL_ITEMS,
  configStringSize,
} from '@quake2ts/shared';

export type ConfigStringEntry = Readonly<{ index: number; value: string }>;

function assertWithinBounds(index: number): void {
  if (index < 0 || index >= ConfigStringIndex.MaxConfigStrings) {
    throw new RangeError(`Configstring index ${index} is out of range (0-${ConfigStringIndex.MaxConfigStrings - 1})`);
  }
}

function assertLength(index: number, value: string): void {
  const maxLength = configStringSize(index);
  if (value.length > maxLength) {
    throw new RangeError(
      `Configstring ${index} exceeds maximum length (${value.length} > ${maxLength}); limit is ${CS_MAX_STRING_LENGTH} chars per slot`,
    );
  }
}

/**
 * Minimal configstring/config index registry that mirrors the rerelease asset
 * indexing routines (`modelindex`, `soundindex`, etc.). The registry maintains
 * deterministic ordering within each configstring range and enforces the same
 * length/slot limits as the C++ helpers.
 */
export class ConfigStringRegistry {
  private readonly values = new Map<number, string>();
  private modelCursor = ConfigStringIndex.Models;
  private soundCursor = ConfigStringIndex.Sounds;
  private imageCursor = ConfigStringIndex.Images;
  private lightCursor = ConfigStringIndex.Lights;
  private shadowLightCursor = ConfigStringIndex.ShadowLights;
  private itemCursor = ConfigStringIndex.Items;
  private playerSkinCursor = ConfigStringIndex.PlayerSkins;
  private generalCursor = ConfigStringIndex.General;

  set(index: number, value: string): number {
    assertWithinBounds(index);
    assertLength(index, value);
    this.values.set(index, value);
    return index;
  }

  get(index: number): string | undefined {
    return this.values.get(index);
  }

  getName(index: number): string | undefined {
    return this.get(index);
  }

  getAll(): string[] {
    const result: string[] = new Array(MAX_CONFIGSTRINGS).fill('');
    for (const [index, value] of this.values.entries()) {
      result[index] = value;
    }
    return result;
  }

  modelIndex(path: string): number {
    return this.register(path, ConfigStringIndex.Models, MAX_MODELS, 'modelCursor');
  }

  soundIndex(path: string): number {
    return this.register(path, ConfigStringIndex.Sounds, MAX_SOUNDS, 'soundCursor');
  }

  findSoundIndex(path: string): number | undefined {
    for (let i = ConfigStringIndex.Sounds; i < ConfigStringIndex.Sounds + MAX_SOUNDS; i += 1) {
      if (this.values.get(i) === path) {
        return i;
      }
    }
    return undefined;
  }

  imageIndex(path: string): number {
    return this.register(path, ConfigStringIndex.Images, MAX_IMAGES, 'imageCursor');
  }

  lightIndex(definition: string): number {
    return this.register(definition, ConfigStringIndex.Lights, MAX_LIGHTSTYLES, 'lightCursor');
  }

  shadowLightIndex(definition: string): number {
    return this.register(definition, ConfigStringIndex.ShadowLights, MAX_SHADOW_LIGHTS, 'shadowLightCursor');
  }

  itemIndex(name: string): number {
    return this.register(name, ConfigStringIndex.Items, MAX_ITEMS, 'itemCursor');
  }

  playerSkinIndex(name: string): number {
    return this.register(name, ConfigStringIndex.PlayerSkins, MAX_CLIENTS, 'playerSkinCursor');
  }

  generalIndex(value: string): number {
    return this.register(value, ConfigStringIndex.General, MAX_GENERAL, 'generalCursor');
  }

  private register(
    value: string,
    start: ConfigStringIndex,
    maxCount: number,
    cursorKey:
      | 'modelCursor'
      | 'soundCursor'
      | 'imageCursor'
      | 'lightCursor'
      | 'shadowLightCursor'
      | 'itemCursor'
      | 'playerSkinCursor'
      | 'generalCursor',
  ): number {
    // Reuse an existing slot if the caller tries to register the same value in the same range.
    for (let i = start; i < start + maxCount; i += 1) {
      if (this.values.get(i) === value) {
        return i;
      }
    }

    const next = this[cursorKey];
    const limit = start + maxCount;
    if (next >= limit) {
      throw new RangeError(`Out of configstring slots for range starting at ${start}`);
    }

    assertLength(next, value);
    this.values.set(next, value);
    this[cursorKey] = next + 1;
    return next;
  }
}
