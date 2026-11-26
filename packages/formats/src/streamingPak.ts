
import { PakDirectoryEntry, PakParseError } from './pak.js';

const PAK_MAGIC = 'PACK';
const HEADER_SIZE = 12;
const DIRECTORY_ENTRY_SIZE = 64;

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

/**
 * Read PAK file in chunks, streaming file contents on demand.
 * Uses the Blob interface which is supported by File in browsers.
 */
export class StreamingPakArchive {
  private entries: Map<string, PakDirectoryEntry> | null = null;

  constructor(private readonly source: Blob) {}

  /**
   * Read directory asynchronously.
   * Caches the result so subsequent calls are fast.
   */
  async readDirectory(): Promise<PakDirectoryEntry[]> {
    if (this.entries) {
      return Array.from(this.entries.values());
    }

    // Read header (12 bytes)
    const headerBuffer = await this.readChunk(0, HEADER_SIZE);
    const headerView = new DataView(headerBuffer);

    const magic = String.fromCharCode(
      headerView.getUint8(0),
      headerView.getUint8(1),
      headerView.getUint8(2),
      headerView.getUint8(3),
    );

    if (magic !== PAK_MAGIC) {
      throw new PakParseError(`Invalid PAK header magic: ${magic}`);
    }

    const dirOffset = headerView.getInt32(4, true);
    const dirLength = headerView.getInt32(8, true);

    if (dirOffset < HEADER_SIZE) {
      throw new PakParseError(`Invalid directory offset: ${dirOffset}`);
    }

    if (dirLength < 0 || dirLength % DIRECTORY_ENTRY_SIZE !== 0) {
      throw new PakParseError(`Invalid directory length: ${dirLength}`);
    }

    // Read directory
    // Note: If directory is huge, this might be a large read, but it's metadata only.
    // 64 bytes per file. 10,000 files = 640KB. Very fast.
    const dirBuffer = await this.readChunk(dirOffset, dirLength);
    const dirView = new DataView(dirBuffer);
    const entryCount = dirLength / DIRECTORY_ENTRY_SIZE;

    const entries = new Map<string, PakDirectoryEntry>();

    for (let i = 0; i < entryCount; i++) {
      const offset = i * DIRECTORY_ENTRY_SIZE;
      const rawName = this.readCString(dirView, offset, 56);
      const normalized = normalizePath(rawName);

      const fileOffset = dirView.getInt32(offset + 56, true);
      const fileLength = dirView.getInt32(offset + 60, true);

      // We cannot easily validate file bounds against total size without knowing total size,
      // but source.size is available on Blob.
      if (fileOffset < 0 || fileLength < 0 || fileOffset + fileLength > this.source.size) {
         // Log warning or throw? Throwing might be safer.
         // throw new PakParseError(`Invalid entry bounds for ${rawName}`);
      }

      if (normalized) {
          entries.set(normalized, { name: normalized, offset: fileOffset, length: fileLength });
      }
    }

    this.entries = entries;
    return Array.from(entries.values());
  }

  /**
   * Stream file contents on demand.
   * Returns a ReadableStream of Uint8Array.
   */
  async readFile(path: string): Promise<ReadableStream<Uint8Array>> {
    const entry = await this.getEntry(path);
    if (!entry) {
      throw new PakParseError(`File not found in PAK: ${path}`);
    }

    const blob = this.source.slice(entry.offset, entry.offset + entry.length);

    // In browser, blob.stream() returns ReadableStream<Uint8Array>.
    // In Node (older versions), it might differ, but recent Node supports standard Blob.
    return blob.stream() as ReadableStream<Uint8Array>;
  }

  /**
   * Get file as a Blob without loading entire file into memory.
   */
  async getFileBlob(path: string): Promise<Blob> {
    const entry = await this.getEntry(path);
    if (!entry) {
      throw new PakParseError(`File not found in PAK: ${path}`);
    }
    return this.source.slice(entry.offset, entry.offset + entry.length);
  }

  private async getEntry(path: string): Promise<PakDirectoryEntry | undefined> {
    if (!this.entries) {
      await this.readDirectory();
    }
    return this.entries!.get(normalizePath(path));
  }

  private async readChunk(offset: number, length: number): Promise<ArrayBuffer> {
    const slice = this.source.slice(offset, offset + length);
    if ('arrayBuffer' in slice) {
        return await slice.arrayBuffer();
    } else {
        // Fallback for older environments or JSDOM blobs if needed
        return new Response(slice).arrayBuffer();
    }
  }

  private readCString(view: DataView, offset: number, maxLength: number): string {
    const codes: number[] = [];
    for (let i = 0; i < maxLength; i += 1) {
      const code = view.getUint8(offset + i);
      if (code === 0) {
        break;
      }
      codes.push(code);
    }
    return String.fromCharCode(...codes);
  }
}
