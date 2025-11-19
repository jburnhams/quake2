import { ConfigStringRegistry } from '../configstrings.js';
import type { AudioBufferLike } from './context.js';

export class SoundRegistry {
  private readonly buffers = new Map<number, AudioBufferLike>();

  constructor(private readonly configStrings = new ConfigStringRegistry()) {}

  register(name: string, buffer: AudioBufferLike): number {
    const index = this.configStrings.soundIndex(name);
    this.buffers.set(index, buffer);
    return index;
  }

  get(index: number): AudioBufferLike | undefined {
    return this.buffers.get(index);
  }

  has(index: number): boolean {
    return this.buffers.has(index);
  }
}
