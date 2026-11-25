/*
 * Mounts archives in priority order and answers lookups, listings and reads across all of them,
 * the later or higher-priority archive winning where two hold the same path. Knows nothing about
 * any archive format: anything that implements {@link Archive} can be mounted.
 */

/** One file inside an archive. */
export interface ArchiveEntry {
  readonly name: string;
  readonly offset: number;
  readonly length: number;
}

/** What the file system needs from an archive (a Quake PAK, a ZIP reader, a directory). */
export interface Archive {
  readonly name: string;
  /** Total size in bytes, for `getPakInfo`. */
  readonly size: number;
  listEntries(): ArchiveEntry[];
  readFile(path: string): Uint8Array;
}

/** Lower-cases, turns backslashes into slashes and drops leading slashes, so lookups ignore case. */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

type VfsSource = { archive: Archive; entry: ArchiveEntry; priority: number };

export interface VirtualFileHandle {
  readonly path: string;
  readonly size: number;
  readonly sourcePak: string;
}

export interface FileMetadata extends VirtualFileHandle {
  readonly offset: number;
}

export interface FileInfo extends VirtualFileHandle {}

export interface DirectoryNode {
  readonly name: string;
  readonly path: string;
  readonly files: FileInfo[];
  readonly directories: DirectoryNode[];
}

export interface PakInfo {
  readonly filename: string;
  readonly entryCount: number;
  readonly totalSize: number;
  readonly priority?: number;
}

export interface DirectoryListing {
  readonly files: VirtualFileHandle[];
  readonly directories: string[];
}

interface MountedPak {
    pak: Archive;
    priority: number;
}

export class VirtualFileSystem {
  private readonly mounts: MountedPak[] = [];
  // files maps path -> list of sources, sorted by priority (high to low)
  private readonly files = new Map<string, VfsSource[]>();

  constructor(archives: Archive[] = []) {
    archives.forEach((archive) => this.mountPak(archive));
  }

  /** Mounts an archive; at equal priority the one mounted last wins. Remounting changes its priority. */
  mount(archive: Archive, priority: number = 0): Archive {
    return this.mountPak(archive, priority);
  }

  /** The same as {@link mount}; the name the engine has always used. */
  mountPak(archive: Archive, priority: number = 0): Archive {
    // Remove if already mounted to update priority
    const existingIndex = this.mounts.findIndex(m => m.pak === archive);
    if (existingIndex !== -1) {
        this.mounts.splice(existingIndex, 1);
    }

    this.mounts.push({ pak: archive, priority });
    this.mounts.sort((a, b) => b.priority - a.priority); // Sort high priority first

    // Index files
    for (const entry of archive.listEntries()) {
      const key = normalizePath(entry.name);
      const source: VfsSource = { archive, entry, priority };

      if (!this.files.has(key)) {
          this.files.set(key, []);
      }
      const sources = this.files.get(key)!;

      // Remove existing entry for this archive if any
      const idx = sources.findIndex(s => s.archive === archive);
      if (idx !== -1) {
          sources.splice(idx, 1);
      }

      // Use unshift to prepend so that for equal priority, the last mounted one comes first
      sources.unshift(source);
      // Sort sources by priority descending (stable sort preserves insertion order for equal priority)
      sources.sort((a, b) => b.priority - a.priority);
    }
    return archive;
  }

  setPriority(archive: Archive, priority: number): void {
      this.mountPak(archive, priority);
  }

  getPaks(): MountedPak[] {
      // Load order: lowest priority (the base game) first.
      return [...this.mounts].sort((a, b) => a.priority - b.priority);
  }

  get mountedPaks(): readonly Archive[] {
    return this.mounts.map(m => m.pak);
  }

  hasFile(path: string): boolean {
    return this.files.has(normalizePath(path));
  }

  private getSource(path: string): VfsSource | undefined {
      const sources = this.files.get(normalizePath(path));
      if (!sources || sources.length === 0) return undefined;
      // Sources are sorted by priority desc, so first one is the winner
      return sources[0];
  }

  stat(path: string): VirtualFileHandle | undefined {
    const source = this.getSource(path);
    if (!source) {
      return undefined;
    }
    return { path: source.entry.name, size: source.entry.length, sourcePak: source.archive.name };
  }

  getFileMetadata(path: string): FileMetadata | undefined {
    const source = this.getSource(path);
    if (!source) {
      return undefined;
    }
    return {
      path: source.entry.name,
      size: source.entry.length,
      sourcePak: source.archive.name,
      offset: source.entry.offset,
    };
  }

  async readFile(path: string): Promise<Uint8Array> {
    const source = this.getSource(path);
    if (!source) {
      throw new Error(`File not found in VFS: ${path}`);
    }
    return source.archive.readFile(path);
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    return this.readFile(path);
  }

  streamFile(path: string, chunkSize = 1024 * 1024): ReadableStream<Uint8Array> {
    const source = this.getSource(path);
    if (!source) {
      throw new Error(`File not found in VFS: ${path}`);
    }

    const fullData = source.archive.readFile(path);

    let offset = 0;
    const totalSize = fullData.length;

    return new ReadableStream({
      pull(controller) {
        if (offset >= totalSize) {
          controller.close();
          return;
        }

        const end = Math.min(offset + chunkSize, totalSize);
        const chunk = fullData.slice(offset, end);
        offset = end;
        controller.enqueue(chunk);
      }
    });
  }

  async readTextFile(path: string): Promise<string> {
    const data = await this.readFile(path);
    return new TextDecoder('utf-8').decode(data);
  }

  list(directory = ''): DirectoryListing {
    const dir = normalizePath(directory).replace(/\/+$|^\//g, '');
    const files: VirtualFileHandle[] = [];
    const directories = new Set<string>();
    const prefix = dir ? `${dir}/` : '';

    for (const [path, sources] of this.files) {
      const source = sources[0]; // Winner
      if (dir) {
          if (!source.entry.name.startsWith(prefix)) {
            continue;
          }
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

  async listDirectory(path: string): Promise<FileInfo[]> {
    const listing = this.list(path);
    return listing.files;
  }

  findByExtension(extension: string | string[] | RegExp): VirtualFileHandle[] {
    if (extension instanceof RegExp) {
        return this.searchFiles(extension);
    }
    if (Array.isArray(extension)) {
        return this.listByExtension(extension);
    }

    const normalizedExt = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
    const results: VirtualFileHandle[] = [];
    for (const [path, sources] of this.files) {
      const source = sources[0];
      if (source.entry.name.toLowerCase().endsWith(normalizedExt)) {
        results.push({ path: source.entry.name, size: source.entry.length, sourcePak: source.archive.name });
      }
    }
    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  listByExtension(extensions: string[]): FileInfo[] {
    const normalizedExts = new Set(
      extensions.map((ext) => (ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`)),
    );
    const results: FileInfo[] = [];
    for (const [path, sources] of this.files) {
        const source = sources[0];
      const name = source.entry.name.toLowerCase();
      for (const ext of normalizedExts) {
        if (name.endsWith(ext)) {
          results.push({
            path: source.entry.name,
            size: source.entry.length,
            sourcePak: source.archive.name,
          });
          break;
        }
      }
    }
    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  searchFiles(pattern: RegExp): FileInfo[] {
    const results: FileInfo[] = [];
    for (const [path, sources] of this.files) {
        const source = sources[0];
      if (pattern.test(source.entry.name)) {
        results.push({
          path: source.entry.name,
          size: source.entry.length,
          sourcePak: source.archive.name,
        });
      }
    }
    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  getPakInfo(): PakInfo[] {
    return this.mounts.map((m) => ({
      filename: m.pak.name,
      entryCount: m.pak.listEntries().length,
      totalSize: m.pak.size,
      priority: m.priority
    }));
  }

  getDirectoryTree(): DirectoryNode {
    const root: DirectoryNode = {
      name: '',
      path: '',
      files: [],
      directories: [],
    };

    const nodeMap = new Map<string, DirectoryNode>();
    nodeMap.set('', root);

    // Get all files and sort them to ensure consistent tree
    const allFiles = Array.from(this.files.values())
      .map((sources) => {
          const s = sources[0];
          return {
            path: s.entry.name,
            size: s.entry.length,
            sourcePak: s.archive.name,
          };
      })
      .sort((a, b) => a.path.localeCompare(b.path));

    for (const file of allFiles) {
      const parts = file.path.split('/');
      const fileName = parts.pop()!;
      let currentPath = '';
      let currentNode = root;

      for (const part of parts) {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        let nextNode = nodeMap.get(currentPath);
        if (!nextNode) {
          nextNode = {
            name: part,
            path: currentPath,
            files: [],
            directories: [],
          };
          currentNode.directories.push(nextNode);
          nodeMap.set(currentPath, nextNode);
        }
        currentNode = nextNode;
      }

      currentNode.files.push(file);
    }

    return root;
  }
}
