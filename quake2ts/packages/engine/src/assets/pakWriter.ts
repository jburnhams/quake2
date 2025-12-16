import { normalizePath } from './pak';

const PAK_MAGIC = 'PACK';
const HEADER_SIZE = 12;
const DIRECTORY_ENTRY_SIZE = 64;

/**
 * Utility class for creating Quake 2 PAK archives.
 */
export class PakWriter {
  private entries = new Map<string, Uint8Array>();

  /**
   * Adds a file to the archive.
   * @param path The file path (will be normalized to lowercase, forward slashes).
   * @param data The file content.
   */
  addFile(path: string, data: Uint8Array): void {
    const normalized = normalizePath(path);
    if (normalized.length > 56) {
      throw new Error(`Path too long: '${normalized}' (max 56 chars)`);
    }
    this.entries.set(normalized, data);
  }

  /**
   * Removes a file from the archive.
   * @param path The file path.
   * @returns True if the file existed and was removed.
   */
  removeFile(path: string): boolean {
    return this.entries.delete(normalizePath(path));
  }

  /**
   * Serializes the current entries into a PAK archive buffer.
   */
  build(): Uint8Array {
    // Calculate sizes
    let fileDataSize = 0;
    for (const data of this.entries.values()) {
      fileDataSize += data.byteLength;
    }

    const directorySize = this.entries.size * DIRECTORY_ENTRY_SIZE;
    const totalSize = HEADER_SIZE + fileDataSize + directorySize;

    const buffer = new Uint8Array(totalSize);
    const view = new DataView(buffer.buffer);

    // Write Header
    view.setUint8(0, 'P'.charCodeAt(0));
    view.setUint8(1, 'A'.charCodeAt(0));
    view.setUint8(2, 'C'.charCodeAt(0));
    view.setUint8(3, 'K'.charCodeAt(0));

    // Directory Offset (files come first, then directory)
    const dirOffset = HEADER_SIZE + fileDataSize;
    view.setInt32(4, dirOffset, true);
    view.setInt32(8, directorySize, true);

    // Write Files
    let currentOffset = HEADER_SIZE;
    const fileOffsets = new Map<string, number>();

    // We sort keys to ensure deterministic output for testing, though not strictly required by format
    const sortedKeys = Array.from(this.entries.keys()).sort();

    for (const name of sortedKeys) {
      const data = this.entries.get(name)!;
      fileOffsets.set(name, currentOffset);
      buffer.set(data, currentOffset);
      currentOffset += data.byteLength;
    }

    // Write Directory
    let dirEntryOffset = dirOffset;
    const encoder = new TextEncoder();

    for (const name of sortedKeys) {
      const data = this.entries.get(name)!;

      // Name (56 bytes)
      const nameBytes = encoder.encode(name);
      if (nameBytes.length > 56) {
         // Should have been caught by addFile, but check again for safety
         throw new Error(`Path too long after encoding: ${name}`);
      }

      for (let i = 0; i < 56; i++) {
        if (i < nameBytes.length) {
          view.setUint8(dirEntryOffset + i, nameBytes[i]);
        } else {
          view.setUint8(dirEntryOffset + i, 0); // Padding
        }
      }

      // Offset
      view.setInt32(dirEntryOffset + 56, fileOffsets.get(name)!, true);

      // Length
      view.setInt32(dirEntryOffset + 60, data.byteLength, true);

      dirEntryOffset += DIRECTORY_ENTRY_SIZE;
    }

    return buffer;
  }

  /**
   * Static helper to build a PAK from a map of entries.
   */
  static buildFromEntries(entries: Map<string, Uint8Array>): Uint8Array {
    const writer = new PakWriter();
    for (const [path, data] of entries) {
      writer.addFile(path, data);
    }
    return writer.build();
  }
}
