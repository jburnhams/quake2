import { PakArchive, PakDirectoryEntry, normalizePath } from './pak.js';

type VfsSource = { archive: PakArchive; entry: PakDirectoryEntry };

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

  getFileMetadata(path: string): FileMetadata | undefined {
    const source = this.files.get(normalizePath(path));
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
    const source = this.files.get(normalizePath(path));
    if (!source) {
      throw new Error(`File not found in VFS: ${path}`);
    }
    return source.archive.readFile(path);
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    return this.readFile(path);
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

  async listDirectory(path: string): Promise<FileInfo[]> {
    const listing = this.list(path);
    return listing.files;
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

  listByExtension(extensions: string[]): FileInfo[] {
    const normalizedExts = new Set(
      extensions.map((ext) => (ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`)),
    );
    const results: FileInfo[] = [];
    for (const source of this.files.values()) {
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
    for (const source of this.files.values()) {
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
    return this.mounts.map((pak) => ({
      filename: pak.name,
      entryCount: pak.listEntries().length,
      totalSize: pak.size,
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
      .map((s) => ({
        path: s.entry.name,
        size: s.entry.length,
        sourcePak: s.archive.name,
      }))
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
