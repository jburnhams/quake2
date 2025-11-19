import { decodeOgg, type OggAudio } from './ogg.js';
import { parseWav } from './wav.js';
import { VirtualFileSystem } from './vfs.js';
import { LruCache } from './cache.js';

export type DecodedAudio = OggAudio;

export class AudioRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioRegistryError';
  }
}

export interface AudioRegistryOptions {
  readonly cacheSize?: number;
}

export class AudioRegistry {
  private readonly cache: LruCache<DecodedAudio>;
  private readonly refCounts = new Map<string, number>();

  constructor(private readonly vfs: VirtualFileSystem, options: AudioRegistryOptions = {}) {
    this.cache = new LruCache<DecodedAudio>(options.cacheSize ?? 64);
  }

  get size(): number {
    return this.cache.size;
  }

  async load(path: string): Promise<DecodedAudio> {
    const normalized = path.toLowerCase();
    const cached = this.cache.get(normalized);
    if (cached) {
      this.refCounts.set(normalized, (this.refCounts.get(normalized) ?? 0) + 1);
      return cached;
    }

    const data = await this.vfs.readFile(path);
    const arrayBuffer = data.slice().buffer;
    const audio = await this.decodeByExtension(path, arrayBuffer);
    this.cache.set(normalized, audio);
    this.refCounts.set(normalized, 1);
    return audio;
  }

  release(path: string): void {
    const normalized = path.toLowerCase();
    const count = this.refCounts.get(normalized) ?? 0;
    if (count <= 1) {
      this.cache.delete(normalized);
      this.refCounts.delete(normalized);
    } else {
      this.refCounts.set(normalized, count - 1);
    }
  }

  clearAll(): void {
    this.cache.clear();
    this.refCounts.clear();
  }

  private async decodeByExtension(path: string, buffer: ArrayBuffer): Promise<DecodedAudio> {
    const lower = path.toLowerCase();
    if (lower.endsWith('.wav')) {
      const wav = parseWav(buffer);
      const channels = wav.channels;
      const channelData: Float32Array[] = Array.from({ length: channels }, () => new Float32Array(wav.samples.length / channels));
      for (let i = 0; i < wav.samples.length; i += 1) {
        channelData[i % channels]![Math.floor(i / channels)] = wav.samples[i]!;
      }
      return { sampleRate: wav.sampleRate, channels, bitDepth: wav.bitsPerSample, channelData } satisfies OggAudio;
    }
    if (lower.endsWith('.ogg') || lower.endsWith('.oga')) {
      return decodeOgg(buffer);
    }
    throw new AudioRegistryError(`Unsupported audio format: ${path}`);
  }
}
