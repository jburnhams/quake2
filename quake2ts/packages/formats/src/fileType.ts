export enum FileType {
  Unknown = 'unknown',
  BSP = 'bsp',
  MD2 = 'md2',
  MD3 = 'md3',
  WAL = 'wal',
  PCX = 'pcx',
  TGA = 'tga',
  WAV = 'wav',
  OGG = 'ogg',
  TXT = 'txt',
  CFG = 'cfg',
  DEM = 'dem',
}

const EXTENSION_MAP: Record<string, FileType> = {
  '.bsp': FileType.BSP,
  '.md2': FileType.MD2,
  '.md3': FileType.MD3,
  '.wal': FileType.WAL,
  '.pcx': FileType.PCX,
  '.tga': FileType.TGA,
  '.wav': FileType.WAV,
  '.ogg': FileType.OGG,
  '.txt': FileType.TXT,
  '.cfg': FileType.CFG,
  '.dm2': FileType.DEM,
};

// Magic bytes helpers
function checkMagic(data: Uint8Array, magic: number[]): boolean {
  if (data.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (data[i] !== magic[i]) return false;
  }
  return true;
}

// Magic bytes definitions
const MAGIC_BSP = [0x49, 0x42, 0x53, 0x50]; // IBSP
const MAGIC_MD2 = [0x49, 0x44, 0x50, 0x32]; // IDP2
const MAGIC_MD3 = [0x49, 0x44, 0x50, 0x33]; // IDP3
const MAGIC_PCX = [0x0a]; // PCX starts with 0x0A (manufacturer)
const MAGIC_RIFF = [0x52, 0x49, 0x46, 0x46]; // RIFF
const MAGIC_WAVE = [0x57, 0x41, 0x56, 0x45]; // WAVE (offset 8)
const MAGIC_OGG = [0x4f, 0x67, 0x67, 0x53]; // OggS
const MAGIC_DEM = [0x49, 0x44, 0x4d, 0x32]; // IDM2 (Quake 2 Demo) - wait, demo format is different.
// Actually standard dm2 demos don't have a uniform global header magic, they are a sequence of server messages.
// But some sources say they start with server version/protocol which is a string.
// Let's rely on extension for DEM unless we want to parse content.

export function detectFileType(path: string, data?: Uint8Array): FileType {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();

  if (data) {
    // Try magic bytes first for robust detection
    if (checkMagic(data, MAGIC_BSP)) return FileType.BSP;
    if (checkMagic(data, MAGIC_MD2)) return FileType.MD2;
    if (checkMagic(data, MAGIC_MD3)) return FileType.MD3;
    if (checkMagic(data, MAGIC_OGG)) return FileType.OGG;

    // PCX is tricky, just 0x0A at start + version check usually
    if (data.length > 128 && data[0] === 0x0a && data[1] < 6) return FileType.PCX; // Basic check

    // WAV is RIFF....WAVE
    if (checkMagic(data, MAGIC_RIFF) && data.length >= 12) {
      if (data[8] === 0x57 && data[9] === 0x41 && data[10] === 0x56 && data[11] === 0x45) {
        return FileType.WAV;
      }
    }
  }

  // Fallback to extension
  if (EXTENSION_MAP[ext]) {
    return EXTENSION_MAP[ext];
  }

  return FileType.Unknown;
}

export function isTextFile(path: string): boolean {
  const type = detectFileType(path);
  return type === FileType.TXT || type === FileType.CFG;
}

export function isBinaryFile(path: string): boolean {
  return !isTextFile(path);
}
