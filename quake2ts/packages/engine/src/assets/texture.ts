import { LruCache } from './cache.js';
import { pcxToRgba, type PcxImage } from './pcx.js';
import { parseWal, type WalTexture } from './wal.js';
import { TgaImage } from './tga.js';

export interface PreparedTexture {
  readonly width: number;
  readonly height: number;
  readonly levels: readonly TextureLevel[];
  readonly source: 'pcx' | 'wal' | 'tga';
}

export interface TextureLevel {
  readonly level: number;
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

export interface TextureCacheOptions {
  readonly capacity?: number;
}

export class TextureCache {
  private readonly cache: LruCache<PreparedTexture>;

  constructor(options: TextureCacheOptions = {}) {
    this.cache = new LruCache<PreparedTexture>(options.capacity ?? 128);
  }

  get size(): number {
    return this.cache.size;
  }

  get(key: string): PreparedTexture | undefined {
    return this.cache.get(key.toLowerCase());
  }

  set(key: string, texture: PreparedTexture): void {
    this.cache.set(key.toLowerCase(), texture);
  }

  clear(): void {
    this.cache.clear();
  }
}

export function walToRgba(wal: WalTexture, palette: Uint8Array): PreparedTexture {
  const levels: TextureLevel[] = [];
  for (const mip of wal.mipmaps) {
    const rgba = new Uint8Array(mip.width * mip.height * 4);
    for (let i = 0; i < mip.data.length; i += 1) {
      const colorIndex = mip.data[i]!;
      const paletteIndex = colorIndex * 3;
      const outIndex = i * 4;
      rgba[outIndex] = palette[paletteIndex]!;
      rgba[outIndex + 1] = palette[paletteIndex + 1]!;
      rgba[outIndex + 2] = palette[paletteIndex + 2]!;
      rgba[outIndex + 3] = colorIndex === 255 ? 0 : 255;
    }
    levels.push({ level: mip.level, width: mip.width, height: mip.height, rgba });
  }

  return { width: wal.width, height: wal.height, levels, source: 'wal' };
}

export function preparePcxTexture(pcx: PcxImage): PreparedTexture {
  const rgba = pcxToRgba(pcx);
  const level: TextureLevel = { level: 0, width: pcx.width, height: pcx.height, rgba };
  return { width: pcx.width, height: pcx.height, levels: [level], source: 'pcx' };
}

export function prepareTgaTexture(tga: TgaImage): PreparedTexture {
  const level: TextureLevel = { level: 0, width: tga.width, height: tga.height, rgba: tga.pixels };
  return { width: tga.width, height: tga.height, levels: [level], source: 'tga' };
}

export function parseWalTexture(buffer: ArrayBuffer, palette: Uint8Array): PreparedTexture {
  return walToRgba(parseWal(buffer), palette);
}
