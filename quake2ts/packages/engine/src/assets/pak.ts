const PAK_MAGIC = 'PACK';
const HEADER_SIZE = 12;
const DIRECTORY_ENTRY_SIZE = 64;

export interface PakDirectoryEntry {
  readonly name: string;
  readonly offset: number;
  readonly length: number;
}

export interface PakValidationResult {
  readonly checksum: number;
  readonly entries: readonly PakDirectoryEntry[];
}

function readCString(view: DataView, offset: number, maxLength: number): string {
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

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function createCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
}

const CRC_TABLE = createCrcTable();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i];
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export class PakParseError extends Error {}

export class PakArchive {
  static fromArrayBuffer(name: string, buffer: ArrayBuffer): PakArchive {
    const view = new DataView(buffer);
    if (buffer.byteLength < HEADER_SIZE) {
      throw new PakParseError('PAK buffer too small to contain header');
    }

    const magic = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
    );

    if (magic !== PAK_MAGIC) {
      throw new PakParseError(`Invalid PAK header magic: ${magic}`);
    }

    const dirOffset = view.getInt32(4, true);
    const dirLength = view.getInt32(8, true);

    if (dirOffset < HEADER_SIZE) {
      throw new PakParseError(`Invalid directory offset: ${dirOffset}`);
    }

    if (dirLength < 0 || dirLength % DIRECTORY_ENTRY_SIZE !== 0) {
      throw new PakParseError(`Invalid directory length: ${dirLength}`);
    }

    const dirEnd = dirOffset + dirLength;
    if (dirEnd > buffer.byteLength) {
      throw new PakParseError('Directory exceeds buffer length');
    }

    const entryCount = dirLength / DIRECTORY_ENTRY_SIZE;
    const entries: PakDirectoryEntry[] = [];
    const dedupe = new Map<string, PakDirectoryEntry>();

    for (let i = 0; i < entryCount; i += 1) {
      const offset = dirOffset + i * DIRECTORY_ENTRY_SIZE;
      const rawName = readCString(view, offset, 56);
      const normalized = normalizePath(rawName);

      const fileOffset = view.getInt32(offset + 56, true);
      const fileLength = view.getInt32(offset + 60, true);

      if (fileOffset < 0 || fileLength < 0 || fileOffset + fileLength > buffer.byteLength) {
        throw new PakParseError(
          `Invalid entry bounds for ${rawName || '<unnamed>'} (offset=${fileOffset}, length=${fileLength})`,
        );
      }

      if (!normalized) {
        throw new PakParseError(`Entry ${i} has an empty name`);
      }

      const entry: PakDirectoryEntry = { name: normalized, offset: fileOffset, length: fileLength };
      dedupe.set(normalized, entry);
    }

    entries.push(...dedupe.values());

    return new PakArchive(name, buffer, entries, crc32(new Uint8Array(buffer)));
  }

  readonly entries: ReadonlyMap<string, PakDirectoryEntry>;
  readonly checksum: number;
  readonly size: number;

  private constructor(
    readonly name: string,
    private readonly buffer: ArrayBuffer,
    entries: PakDirectoryEntry[],
    checksum: number,
  ) {
    this.entries = new Map(entries.map((entry) => [entry.name, entry]));
    this.checksum = checksum;
    this.size = buffer.byteLength;
  }

  getEntry(path: string): PakDirectoryEntry | undefined {
    return this.entries.get(normalizePath(path));
  }

  listEntries(): PakDirectoryEntry[] {
    return Array.from(this.entries.values());
  }

  readFile(path: string): Uint8Array {
    const entry = this.getEntry(path);
    if (!entry) {
      throw new PakParseError(`File not found in PAK: ${path}`);
    }
    return new Uint8Array(this.buffer, entry.offset, entry.length);
  }

  validate(): PakValidationResult {
    return {
      checksum: this.checksum,
      entries: this.listEntries(),
    };
  }
}

export function calculatePakChecksum(buffer: ArrayBuffer): number {
  return crc32(new Uint8Array(buffer));
}

export { normalizePath };
