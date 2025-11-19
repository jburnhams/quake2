import { PakArchive, PakDirectoryEntry, normalizePath } from './pak.js';

type VfsSource = { archive: PakArchive; entry: PakDirectoryEntry };

export interface VirtualFileHandle {
  readonly path: string;
  readonly size: number;
  readonly sourcePak: string;
}

export interface DirectoryListing {
  readonly files: VirtualFileHandle[];
  readonly directories: string[];
}

export class VirtualFileSystem {
  private readonly mounts: PakArchive[] = [];
  private readonly files = new Map<string, VfsSource>();

  constructor(archives: PakArchive[] = []) {
    archives.forEach((archive) => this.mountPak(archive));
  }

  mountPak(archive: PakArchive): void {
    this.mounts.push(archive);
    for (const entry of archive.listEntries()) {
      const key = normalizePath(entry.name);
      this.files.set(key, { archive, entry });
    }
  }

  get mountedPaks(): readonly PakArchive[] {
    return [...this.mounts];
  }

  hasFile(path: string): boolean {
    return this.files.has(normalizePath(path));
  }

  stat(path: string): VirtualFileHandle | undefined {
    const source = this.files.get(normalizePath(path));
    if (!source) {
      return undefined;
    }
    return { path: source.entry.name, size: source.entry.length, sourcePak: source.archive.name };
  }

  async readFile(path: string): Promise<Uint8Array> {
    const source = this.files.get(normalizePath(path));
    if (!source) {
      throw new Error(`File not found in VFS: ${path}`);
    }
    return source.archive.readFile(path);
  }

  list(directory = ''): DirectoryListing {
    const dir = normalizePath(directory).replace(/\/+$|^\//g, '');
    const files: VirtualFileHandle[] = [];
    const directories = new Set<string>();
    const prefix = dir ? `${dir}/` : '';

    for (const source of this.files.values()) {
      if (dir && !source.entry.name.startsWith(prefix)) {
        continue;
      }
      const relative = dir ? source.entry.name.slice(prefix.length) : source.entry.name;
      const separatorIndex = relative.indexOf('/');
      if (separatorIndex === -1) {
        files.push({ path: source.entry.name, size: source.entry.length, sourcePak: source.archive.name });
      } else {
        directories.add(relative.slice(0, separatorIndex));
      }
    }

    files.sort((a, b) => a.path.localeCompare(b.path));

    return { files, directories: [...directories].sort() };
  }

  findByExtension(extension: string): VirtualFileHandle[] {
    const normalizedExt = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
    const results: VirtualFileHandle[] = [];
    for (const source of this.files.values()) {
      if (source.entry.name.toLowerCase().endsWith(normalizedExt)) {
        results.push({ path: source.entry.name, size: source.entry.length, sourcePak: source.archive.name });
      }
    }
    return results.sort((a, b) => a.path.localeCompare(b.path));
  }
}
