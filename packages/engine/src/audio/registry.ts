import { ConfigStringRegistry } from '../configstrings.js';
import type { AudioBufferLike } from './context.js';

export class SoundRegistry {
  private readonly buffers = new Map<number, AudioBufferLike>();

  constructor(private readonly configStrings = new ConfigStringRegistry()) {}

  registerName(name: string): number {
    return this.configStrings.soundIndex(name);
  }

  register(name: string, buffer: AudioBufferLike): number {
    const index = this.registerName(name);
    this.buffers.set(index, buffer);
    return index;
  }

  find(name: string): number | undefined {
    return this.configStrings.findSoundIndex(name);
  }

  get(index: number): AudioBufferLike | undefined {
    return this.buffers.get(index);
  }

  has(index: number): boolean {
    return this.buffers.has(index);
  }

  getName(index: number): string | undefined {
    return this.configStrings.getName(index);
  }
}
