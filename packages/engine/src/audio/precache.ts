import { normalizePath } from '../assets/pak.js';
import type { VirtualFileSystem } from '../assets/vfs.js';
import type { AudioBufferLike, AudioContextLike } from './context.js';
import { AudioContextController } from './context.js';
import { SoundRegistry } from './registry.js';

export interface SoundPrecacheOptions {
  vfs: Pick<VirtualFileSystem, 'readFile' | 'stat'>;
  registry: SoundRegistry;
  context: AudioContextController;
  decodeAudio?: (context: AudioContextLike, data: ArrayBuffer) => Promise<AudioBufferLike>;
  soundRoot?: string;
}

export interface SoundPrecacheReport {
  loaded: string[];
  skipped: string[];
  missing: string[];
  errors: Record<string, Error>;
}

export class SoundPrecache {
  private readonly vfs: SoundPrecacheOptions['vfs'];
  private readonly registry: SoundRegistry;
  private readonly contextController: AudioContextController;
  private readonly decodeAudio: NonNullable<SoundPrecacheOptions['decodeAudio']>;
  private readonly soundRoot: string;

  constructor(options: SoundPrecacheOptions) {
    this.vfs = options.vfs;
    this.registry = options.registry;
    this.contextController = options.context;
    this.soundRoot = options.soundRoot ?? 'sound/';
    this.decodeAudio =
      options.decodeAudio ??
      ((context: AudioContextLike, data: ArrayBuffer) => {
        if (!context.decodeAudioData) {
          throw new Error('decodeAudioData is not available on the provided audio context');
        }
        return context.decodeAudioData(data);
      });
  }

  async precache(paths: string[]): Promise<SoundPrecacheReport> {
    const unique = [...new Set(paths.map((p) => this.normalize(p)))];
    const report: SoundPrecacheReport = { loaded: [], skipped: [], missing: [], errors: {} };
    const context = this.contextController.getContext();

    for (const path of unique) {
      try {
        const existingIndex = this.registry.find(path);
        if (existingIndex !== undefined && this.registry.has(existingIndex)) {
          report.skipped.push(path);
          continue;
        }

        const stat = this.vfs.stat(path);
        if (!stat) {
          report.missing.push(path);
          continue;
        }

        const bytes = await this.vfs.readFile(path);
        const copy = bytes.slice().buffer;
        const buffer = await this.decodeAudio(context, copy);
        this.registry.register(path, buffer);
        report.loaded.push(path);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        report.errors[path] = err;
      }
    }

    return report;
  }

  private normalize(path: string): string {
    const normalized = normalizePath(path.replace(/^\//, ''));
    if (normalized.startsWith(this.soundRoot)) {
      return normalized;
    }
    return normalizePath(`${this.soundRoot}${normalized}`);
  }
}
