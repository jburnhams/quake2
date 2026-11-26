// The PAK files the explorer has open, mounted in one strata-vfs file system. A file opened later
// overrides the same path in an earlier one, as the game's own search path does (pak0 < pak1 < mod).
// `version` goes up on every mount, so every read keyed by it is fetched again.
import { PakArchive } from '@quake2ts/formats';
import { VirtualFileSystem } from 'strata-vfs';

export type MountedPak = { name: string; files: number; bytes: number };

export class Library {
  readonly vfs = new VirtualFileSystem();
  private paks: MountedPak[] = [];
  private listeners = new Set<() => void>();
  private ver = 0;

  /** Mounts a PAK above everything already open. Throws a PakParseError naming what is wrong with it. */
  mount(name: string, buffer: ArrayBuffer): MountedPak {
    const archive = PakArchive.fromArrayBuffer(name, buffer);
    this.vfs.mount(archive, this.paks.length);
    const pak = { name, files: archive.listEntries().length, bytes: archive.size };
    this.paks = [...this.paks, pak];
    this.ver += 1;
    this.listeners.forEach((l) => l());
    return pak;
  }

  get mounted(): readonly MountedPak[] {
    return this.paks;
  }

  get version(): number {
    return this.ver;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** A file's bytes as an ArrayBuffer of its own (the parsers take ArrayBuffers). */
  async read(path: string): Promise<ArrayBuffer> {
    const bytes = await this.vfs.readFile(path);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }
}
