import { normalizePath } from './pak.js';

const PAK_MAGIC = 'PACK';
const HEADER_SIZE = 12;
const DIRECTORY_ENTRY_SIZE = 64;

export class PakWriter {
  private files = new Map<string, Uint8Array>();

  addFile(path: string, data: Uint8Array): void {
    const normalized = normalizePath(path);
    if (!normalized) {
      throw new Error(`Invalid path: ${path}`);
    }
    if (normalized.length > 56) {
      throw new Error(`Path too long: ${path} (max 56 chars)`);
    }
    this.files.set(normalized, data);
  }

  removeFile(path: string): boolean {
    const normalized = normalizePath(path);
    return this.files.delete(normalized);
  }

  build(): Uint8Array {
    let currentOffset = HEADER_SIZE;

    // Calculate total size
    // 1. Header (12 bytes)
    // 2. File data
    // 3. Directory

    // Sort keys for deterministic output
    const sortedPaths = Array.from(this.files.keys()).sort();

    const directorySize = sortedPaths.length * DIRECTORY_ENTRY_SIZE;

    // We'll write files first, then directory at the end
    // First pass: calculate offsets and total size
    let fileDataSize = 0;
    for (const path of sortedPaths) {
      fileDataSize += this.files.get(path)!.byteLength;
    }

    const totalSize = HEADER_SIZE + fileDataSize + directorySize;
    const buffer = new Uint8Array(totalSize);
    const view = new DataView(buffer.buffer);

    // Write Header
    // Magic "PACK"
    view.setUint8(0, 'P'.charCodeAt(0));
    view.setUint8(1, 'A'.charCodeAt(0));
    view.setUint8(2, 'C'.charCodeAt(0));
    view.setUint8(3, 'K'.charCodeAt(0));

    // Directory Offset
    const directoryOffset = HEADER_SIZE + fileDataSize;
    view.setInt32(4, directoryOffset, true);

    // Directory Length
    view.setInt32(8, directorySize, true);

    // Write Files and Directory Entries
    let fileOffset = HEADER_SIZE;
    let dirEntryOffset = directoryOffset;

    for (const path of sortedPaths) {
      const data = this.files.get(path)!;

      // Write File Data
      buffer.set(data, fileOffset);

      // Write Directory Entry
      // Name (56 bytes)
      for (let i = 0; i < 56; i++) {
        if (i < path.length) {
          view.setUint8(dirEntryOffset + i, path.charCodeAt(i));
        } else {
          view.setUint8(dirEntryOffset + i, 0); // Null padding
        }
      }

      // File Offset
      view.setInt32(dirEntryOffset + 56, fileOffset, true);

      // File Length
      view.setInt32(dirEntryOffset + 60, data.byteLength, true);

      fileOffset += data.byteLength;
      dirEntryOffset += DIRECTORY_ENTRY_SIZE;
    }

    return buffer;
  }

  static buildFromEntries(entries: Map<string, Uint8Array>): Uint8Array {
    const writer = new PakWriter();
    for (const [path, data] of entries) {
      writer.addFile(path, data);
    }
    return writer.build();
  }
}
