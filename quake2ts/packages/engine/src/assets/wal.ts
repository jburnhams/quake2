export interface WalTexture {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly mipmaps: readonly WalMipmap[];
  readonly animName: string;
  readonly flags: number;
  readonly contents: number;
  readonly value: number;
}

export interface WalMipmap {
  readonly level: number;
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export class WalParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalParseError';
  }
}

export function parseWal(buffer: ArrayBuffer): WalTexture {
  if (buffer.byteLength < 100) {
    throw new WalParseError('WAL buffer too small');
  }

  const view = new DataView(buffer);
  const nameBytes = new Uint8Array(buffer, 0, 32);
  const name = new TextDecoder('utf-8').decode(nameBytes).replace(/\0.*$/, '').trim();
  const width = view.getInt32(32, true);
  const height = view.getInt32(36, true);
  const offsets = [view.getInt32(40, true), view.getInt32(44, true), view.getInt32(48, true), view.getInt32(52, true)];
  const animNameBytes = new Uint8Array(buffer, 56, 32);
  const animName = new TextDecoder('utf-8').decode(animNameBytes).replace(/\0.*$/, '').trim();
  const flags = view.getInt32(88, true);
  const contents = view.getInt32(92, true);
  const value = view.getInt32(96, true);

  if (width <= 0 || height <= 0) {
    throw new WalParseError('Invalid WAL dimensions');
  }

  const mipmaps: WalMipmap[] = [];
  let currentWidth = width;
  let currentHeight = height;

  for (let level = 0; level < offsets.length; level += 1) {
    const offset = offsets[level];
    const expectedSize = Math.max(1, (currentWidth * currentHeight) | 0);
    if (offset <= 0 || offset + expectedSize > buffer.byteLength) {
      throw new WalParseError(`Invalid WAL mip offset for level ${level}`);
    }
    const data = new Uint8Array(buffer, offset, expectedSize);
    mipmaps.push({ level, width: currentWidth, height: currentHeight, data });
    currentWidth = Math.max(1, currentWidth >> 1);
    currentHeight = Math.max(1, currentHeight >> 1);
  }

  return { name, width, height, mipmaps, animName, flags, contents, value };
}
