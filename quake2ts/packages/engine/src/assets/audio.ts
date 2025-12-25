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
  readonly workerPath?: string;
}

export class AudioRegistry {
  private readonly cache: LruCache<DecodedAudio>;
  private readonly refCounts = new Map<string, number>();
  private readonly worker?: Worker;
  private nextRequestId = 0;

  constructor(private readonly vfs: VirtualFileSystem, options: AudioRegistryOptions = {}) {
    this.cache = new LruCache<DecodedAudio>(options.cacheSize ?? 64);
    if (options.workerPath) {
        this.worker = new Worker(options.workerPath, { type: 'module' });
    }
  }

  get size(): number {
    return this.cache.size;
  }

  get capacity(): number {
      return this.cache.capacity;
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

  set capacity(value: number) {
      this.cache.capacity = value;
  }

  private async decodeByExtension(path: string, buffer: ArrayBuffer): Promise<DecodedAudio> {
    const lower = path.toLowerCase();
    if (lower.endsWith('.wav')) {
      if (this.worker) {
          return this.decodeWavInWorker(buffer);
      }
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

  private decodeWavInWorker(buffer: ArrayBuffer): Promise<DecodedAudio> {
      return new Promise((resolve, reject) => {
          if (!this.worker) {
              reject(new Error('Worker not initialized'));
              return;
          }

          const requestId = this.nextRequestId++;

          const handler = (event: MessageEvent) => {
              if (event.data.id !== requestId) return;

              this.worker!.removeEventListener('message', handler);
              if (event.data.type === 'success') {
                  const wav = event.data.data;
                  // Reconstruct channel data from flat samples
                  const channels = wav.channels;
                  const channelData: Float32Array[] = Array.from({ length: channels }, () => new Float32Array(wav.samples.length / channels));
                  for (let i = 0; i < wav.samples.length; i += 1) {
                    channelData[i % channels]![Math.floor(i / channels)] = wav.samples[i]!;
                  }
                  resolve({ sampleRate: wav.sampleRate, channels, bitDepth: wav.bitsPerSample, channelData });
              } else {
                  reject(new Error(event.data.message));
              }
          };

          this.worker.addEventListener('message', handler);
          this.worker.postMessage({ id: requestId, buffer, type: 'wav' }, [buffer]);
      });
  }
}
